//! Tamanho e posição da janela `main`: proporcional à tela na primeira abertura e
//! lembrados nas seguintes.

use std::sync::{Mutex, PoisonError};

use rusqlite::Connection;
use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, Runtime, WebviewWindow, Window, WindowEvent,
};

use crate::db::settings::{self, MainWindowState};

const MAIN_WINDOW: &str = "main";

/// Fração da área útil ocupada na primeira abertura.
const WIDTH_RATIO: f64 = 0.75;
const HEIGHT_RATIO: f64 = 0.80;
/// Limites do tamanho inicial (lógicos). O piso mantém a interface confortável e o teto
/// evita uma janela gigante em telas grandes.
const MIN_INITIAL: (f64, f64) = (1000.0, 650.0);
const MAX_INITIAL: (f64, f64) = (1600.0, 1000.0);
/// Mínimo da janela, o mesmo de `tauri.conf.json`; vale também para áreas pequenas.
const MIN_WINDOW: (f64, f64) = (760.0, 480.0);
/// Parte da janela que precisa aparecer em algum monitor (pixels físicos) para o estado
/// salvo ser considerado alcançável pelo usuário.
const MIN_VISIBLE: (i32, i32) = (100, 50);

/// Retângulo em pixels físicos, como a área útil de um monitor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Tamanho lógico da primeira abertura para uma área útil lógica: 75% × 80%, entre
/// 1000×650 e 1600×1000. Se a área for menor que o piso, a janela ocupa a área inteira,
/// sem ficar abaixo do mínimo da janela (760×480).
pub fn initial_size(area_width: f64, area_height: f64) -> (f64, f64) {
    let axis = |area: f64, ratio: f64, min: f64, max: f64, floor: f64| {
        (area * ratio).clamp(min, max).min(area).max(floor).round()
    };
    (
        axis(
            area_width,
            WIDTH_RATIO,
            MIN_INITIAL.0,
            MAX_INITIAL.0,
            MIN_WINDOW.0,
        ),
        axis(
            area_height,
            HEIGHT_RATIO,
            MIN_INITIAL.1,
            MAX_INITIAL.1,
            MIN_WINDOW.1,
        ),
    )
}

/// Estado da primeira abertura: tamanho proporcional à área útil (física, com a escala do
/// monitor), centralizado nela.
pub fn initial_state(area: Rect, scale: f64) -> MainWindowState {
    let (width, height) = initial_size(area.width as f64 / scale, area.height as f64 / scale);
    let physical = |logical: f64| (logical * scale).round() as i32;
    MainWindowState {
        x: area.x + (area.width - physical(width)) / 2,
        y: area.y + (area.height - physical(height)) / 2,
        width,
        height,
        maximized: false,
    }
}

/// Devolve o estado salvo se a janela ainda aparece em algum dos monitores (área útil
/// física e escala); senão `None`, e quem chama usa o estado da primeira abertura.
pub fn validate(saved: MainWindowState, monitors: &[(Rect, f64)]) -> Option<MainWindowState> {
    let width = saved.width.max(MIN_WINDOW.0);
    let height = saved.height.max(MIN_WINDOW.1);
    let reachable = monitors.iter().any(|(area, scale)| {
        let right = saved.x.saturating_add((width * scale) as i32);
        let bottom = saved.y.saturating_add((height * scale) as i32);
        let visible_width = right.min(area.x + area.width) - saved.x.max(area.x);
        let visible_height = bottom.min(area.y + area.height) - saved.y.max(area.y);
        visible_width >= MIN_VISIBLE.0 && visible_height >= MIN_VISIBLE.1
    });
    reachable.then_some(MainWindowState {
        width,
        height,
        ..saved
    })
}

/// Último tamanho e posição "normais" (não maximizados) vistos, mantidos em memória pelos
/// eventos da janela; o banco só é escrito ao ocultar a janela e ao sair.
#[derive(Default)]
pub struct MainWindowTracker(Mutex<Option<MainWindowState>>);

/// Área útil (sem a barra de tarefas) e escala de um monitor.
fn work_area(monitor: &Monitor) -> (Rect, f64) {
    let area = monitor.work_area();
    let rect = Rect {
        x: area.position.x,
        y: area.position.y,
        width: area.size.width as i32,
        height: area.size.height as i32,
    };
    (rect, monitor.scale_factor())
}

/// Estado a aplicar à janela recém-criada: o salvo, se ainda for alcançável, ou o da
/// primeira abertura no monitor principal. `None` se não há monitor para medir.
pub fn startup_state(app: &AppHandle, saved: Option<MainWindowState>) -> Option<MainWindowState> {
    let monitors: Vec<_> = app
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(work_area)
        .collect();
    saved
        .and_then(|saved| validate(saved, &monitors))
        .or_else(|| {
            let primary = app.primary_monitor().ok().flatten()?;
            let (area, scale) = work_area(&primary);
            Some(initial_state(area, scale))
        })
}

/// Aplica o estado à janela ainda oculta. A posição vai antes do tamanho: o tamanho lógico
/// usa a escala do monitor onde a janela está.
pub fn apply(app: &AppHandle, window: &WebviewWindow, state: MainWindowState) {
    // Falhas aqui não têm tratamento útil: no pior caso a janela abre no tamanho padrão.
    let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
    let _ = window.set_size(tauri::LogicalSize::new(state.width, state.height));
    if state.maximized {
        let _ = window.maximize();
    }
    *lock_tracker(app) = Some(MainWindowState {
        maximized: false,
        ..state
    });
}

fn lock_tracker(app: &AppHandle) -> std::sync::MutexGuard<'_, Option<MainWindowState>> {
    app.state::<MainWindowTracker>()
        .inner()
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

/// Lê tamanho e posição atuais, se a janela está no estado normal.
fn capture<R: Runtime>(window: &WebviewWindow<R>) -> Option<MainWindowState> {
    if window.is_maximized().ok()? || window.is_minimized().ok()? {
        return None;
    }
    let scale = window.scale_factor().ok()?;
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    Some(MainWindowState {
        x: position.x,
        y: position.y,
        width: (size.width as f64 / scale).round(),
        height: (size.height as f64 / scale).round(),
        maximized: false,
    })
}

/// Grava o estado atual da janela `main`. Maximizada, guarda o último tamanho normal visto.
pub fn save(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let mut normal = lock_tracker(app);
    if let Some(current) = capture(&window) {
        *normal = Some(current);
    }
    let Some(normal) = *normal else {
        return;
    };
    let state = MainWindowState {
        maximized: window.is_maximized().unwrap_or(false),
        ..normal
    };
    let connection = app.state::<Mutex<Connection>>();
    let connection = connection.lock().unwrap_or_else(PoisonError::into_inner);
    // Sem tratamento útil: perder o estado só faz a janela abrir como na primeira vez.
    let _ = settings::set_main_window(&connection, &state);
}

/// Acompanha o tamanho e a posição da janela `main` e grava o estado quando o usuário a
/// fecha (o cadastro a oculta para a bandeja).
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW {
        return;
    }
    match event {
        WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
            if let Some(webview) = window.get_webview_window(MAIN_WINDOW)
                && let Some(current) = capture(&webview)
            {
                *window
                    .state::<MainWindowTracker>()
                    .inner()
                    .0
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner) = Some(current);
            }
        }
        WindowEvent::CloseRequested { .. } => save(window.app_handle()),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FULL_HD: Rect = Rect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1032,
    };

    fn state(x: i32, y: i32) -> MainWindowState {
        MainWindowState {
            x,
            y,
            width: 1000.0,
            height: 650.0,
            maximized: false,
        }
    }

    #[test]
    fn initial_size_is_proportional_to_the_work_area() {
        assert_eq!(initial_size(1920.0, 1032.0), (1440.0, 826.0));
        assert_eq!(initial_size(1536.0, 824.0), (1152.0, 659.0));
    }

    #[test]
    fn initial_size_is_capped_on_large_screens() {
        assert_eq!(initial_size(2560.0, 1408.0), (1600.0, 1000.0));
        assert_eq!(initial_size(3840.0, 2100.0), (1600.0, 1000.0));
    }

    #[test]
    fn initial_size_keeps_the_floor_on_small_areas() {
        // 75% de 1280 seria 960 e 80% de 720 seria 576: sobe para 1000×650.
        assert_eq!(initial_size(1280.0, 720.0), (1000.0, 650.0));
    }

    #[test]
    fn initial_size_never_exceeds_an_area_smaller_than_the_floor() {
        assert_eq!(initial_size(900.0, 600.0), (900.0, 600.0));
        // Abaixo do mínimo da janela, vale o mínimo da janela.
        assert_eq!(initial_size(700.0, 400.0), (760.0, 480.0));
    }

    #[test]
    fn initial_state_is_centered_in_the_work_area() {
        let state = initial_state(FULL_HD, 1.0);
        assert_eq!((state.width, state.height), (1440.0, 826.0));
        assert_eq!((state.x, state.y), (240, 103));
        assert!(!state.maximized);
    }

    #[test]
    fn initial_state_uses_logical_size_and_physical_position() {
        // 4K a 150%: área física 3840×2112 (lógica 2560×1408), no monitor à direita.
        let area = Rect {
            x: 1920,
            y: 0,
            width: 3840,
            height: 2112,
        };
        let state = initial_state(area, 1.5);
        assert_eq!((state.width, state.height), (1600.0, 1000.0));
        assert_eq!((state.x, state.y), (1920 + 720, 306));
    }

    #[test]
    fn saved_state_inside_a_monitor_is_kept() {
        let saved = state(300, 200);
        assert_eq!(validate(saved, &[(FULL_HD, 1.0)]), Some(saved));
    }

    #[test]
    fn saved_state_on_a_second_monitor_is_kept_only_while_it_exists() {
        let second = Rect {
            x: 1920,
            y: 0,
            width: 1920,
            height: 1032,
        };
        let saved = state(2000, 100);
        assert_eq!(
            validate(saved, &[(FULL_HD, 1.0), (second, 1.0)]),
            Some(saved)
        );
        assert_eq!(validate(saved, &[(FULL_HD, 1.0)]), None);
    }

    #[test]
    fn saved_state_barely_visible_or_off_screen_is_discarded() {
        let monitors = [(FULL_HD, 1.0)];
        assert_eq!(validate(state(5000, 100), &monitors), None);
        assert_eq!(validate(state(-5000, 100), &monitors), None);
        assert_eq!(validate(state(1900, 100), &monitors), None);
        assert_eq!(validate(state(100, 1020), &monitors), None);
        assert_eq!(validate(state(100, 100), &[]), None);
    }

    #[test]
    fn saved_state_partly_off_screen_but_reachable_is_kept() {
        let saved = state(-600, 100);
        assert_eq!(validate(saved, &[(FULL_HD, 1.0)]), Some(saved));
    }

    #[test]
    fn saved_size_is_raised_to_the_window_minimum() {
        let saved = MainWindowState {
            width: 100.0,
            height: 100.0,
            ..state(0, 0)
        };
        let validated = validate(saved, &[(FULL_HD, 1.0)]).unwrap();
        assert_eq!((validated.width, validated.height), (760.0, 480.0));
    }

    #[test]
    fn saved_state_on_a_monitor_with_negative_coordinates_is_kept() {
        let left = Rect {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1032,
        };
        let saved = state(-1500, 50);
        assert_eq!(validate(saved, &[(left, 1.0)]), Some(saved));
    }
}

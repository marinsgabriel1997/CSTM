//! Menu de colagem: janela `picker` aberta pelo atalho global junto ao cursor do mouse.

use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use rusqlite::Connection;
use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime,
    WebviewWindow, Window, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::cascade::{self, PlacedColumn, Subcolumn};
use crate::db::settings;
use crate::paste;

const PICKER_WINDOW: &str = "picker";
/// Atalho padrão, no formato do `tauri-plugin-global-shortcut` (tecla física).
pub const DEFAULT_SHORTCUT: &str = "Alt+KeyQ";
/// Tamanho lógico do menu, o mesmo declarado em `tauri.conf.json`.
const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 440.0;

/// Evento enviado ao menu a cada abertura, com a posição da coluna principal, para que
/// volte à raiz e recarregue os dados.
const PICKER_OPENED: &str = "picker-opened";
/// Quanto a abertura espera o menu avisar que já desenhou a raiz antes de mostrá-lo mesmo
/// assim (`ready`).
const READY_TIMEOUT: Duration = Duration::from_millis(150);

/// Atalho configurado e se ele está registrado no momento. Fica sem registro quando o
/// Windows o recusa ao iniciar ou enquanto o cadastro grava uma nova combinação.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

type ShortcutLock = Mutex<ShortcutStatus>;

/// Onde `show()` colocou a coluna principal: a cascata abre as demais a partir dela.
#[derive(Debug, Clone, Copy)]
struct MainColumn {
    /// Posição e tamanho em pixels físicos.
    rect: Area,
    /// Área útil do monitor, que é também o retângulo da janela.
    work_area: Area,
    scale: f64,
}

impl MainColumn {
    fn arrange(&self, subs: &[Subcolumn]) -> cascade::Arrangement {
        cascade::arrange(self.rect, self.work_area, self.scale, subs)
    }
}

#[derive(Default)]
struct Opening {
    /// Coluna principal do menu aberto; vazia enquanto o menu nunca foi aberto.
    main: Option<MainColumn>,
    /// Número da abertura mais recente, para o tempo limite reconhecer a sua.
    count: u64,
    /// A janela está visível, mas com a região vazia, à espera de o menu desenhar a raiz.
    waiting: bool,
}

/// Abertura atual do menu de colagem: a coluna principal e a espera pelo aviso de pronto.
#[derive(Default)]
pub struct PickerGeometry(Mutex<Opening>);

/// Retângulo em pixels físicos, como a área útil de um monitor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Area {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Canto superior esquerdo do menu: junto ao cursor, abrindo para a esquerda ou para
/// cima quando não cabe, e sempre dentro da área útil.
pub fn place(cursor: (i32, i32), size: (i32, i32), area: Area) -> (i32, i32) {
    (
        place_axis(cursor.0, size.0, area.x, area.width),
        place_axis(cursor.1, size.1, area.y, area.height),
    )
}

fn place_axis(cursor: i32, length: i32, start: i32, extent: i32) -> i32 {
    let end = start + extent;
    if cursor + length <= end {
        cursor.max(start)
    } else if cursor - length >= start {
        cursor - length
    } else {
        // Não cabe de nenhum lado: encosta no fim, sem nunca esconder o início.
        (end - length).max(start)
    }
}

pub fn shortcut_plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle(app);
            }
        })
        .build()
}

/// Normaliza uma combinação como `Ctrl+Shift+KeyV`: `Ctrl` ou `Alt` obrigatório, `Shift`
/// opcional, sem `Win`; tecla principal entre letras, números, `F1`–`F12` e espaço.
pub fn normalize_shortcut(text: &str) -> Result<String, String> {
    let invalid = || {
        "combinação inválida: use Ctrl ou Alt (com Shift, se quiser) e uma letra, número, F1–F12 ou Espaço"
            .to_string()
    };
    let mut parts: Vec<&str> = text.split('+').map(str::trim).collect();
    let key = parts
        .pop()
        .filter(|key| is_allowed_key(key))
        .ok_or_else(invalid)?;
    let (mut ctrl, mut alt, mut shift) = (false, false, false);
    for part in parts {
        let flag = match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => &mut ctrl,
            "alt" => &mut alt,
            "shift" => &mut shift,
            _ => return Err(invalid()),
        };
        if *flag {
            return Err(invalid());
        }
        *flag = true;
    }
    if !ctrl && !alt {
        return Err(invalid());
    }
    let mut normalized: Vec<&str> = [(ctrl, "Ctrl"), (alt, "Alt"), (shift, "Shift")]
        .into_iter()
        .filter_map(|(on, name)| on.then_some(name))
        .collect();
    normalized.push(key);
    Ok(normalized.join("+"))
}

fn is_allowed_key(key: &str) -> bool {
    let single = |prefix: &str, valid: fn(char) -> bool| {
        key.strip_prefix(prefix)
            .is_some_and(|rest| rest.len() == 1 && rest.chars().all(valid))
    };
    let function = key
        .strip_prefix('F')
        .filter(|number| !number.starts_with('0'))
        .and_then(|number| number.parse::<u8>().ok())
        .is_some_and(|number| (1..=12).contains(&number));
    key == "Space"
        || single("Key", |c| c.is_ascii_uppercase())
        || single("Digit", |c| c.is_ascii_digit())
        || function
}

/// Registra o atalho salvo (ou o padrão); a falha (por exemplo, atalho já usado por outro
/// programa) não impede o aplicativo de abrir e fica disponível para o cadastro exibir.
pub fn register_shortcut(app: &App, conn: &Connection) {
    let shortcut = settings::get_setting(conn, settings::SHORTCUT)
        .ok()
        .flatten()
        .and_then(|saved| normalize_shortcut(&saved).ok())
        .unwrap_or_else(|| DEFAULT_SHORTCUT.to_string());
    let registered = app.global_shortcut().register(shortcut.as_str()).is_ok();
    app.manage::<ShortcutLock>(Mutex::new(ShortcutStatus {
        shortcut,
        registered,
    }));
}

fn lock_shortcut(app: &AppHandle) -> MutexGuard<'_, ShortcutStatus> {
    app.state::<ShortcutLock>()
        .inner()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

pub fn shortcut_status(app: &AppHandle) -> ShortcutStatus {
    lock_shortcut(app).clone()
}

/// Troca o atalho: registra o novo, grava e só então libera o anterior. Em qualquer
/// falha, o atalho anterior continua valendo.
pub fn change_shortcut(
    app: &AppHandle,
    conn: &Connection,
    text: &str,
) -> Result<ShortcutStatus, String> {
    let shortcut = normalize_shortcut(text)?;
    let mut status = lock_shortcut(app);
    let manager = app.global_shortcut();
    let unchanged = shortcut == status.shortcut && status.registered;
    if !unchanged {
        manager
            .register(shortcut.as_str())
            .map_err(|error| format!("o atalho não pôde ser registrado: {error}"))?;
    }
    if let Err(error) = settings::set_setting(conn, settings::SHORTCUT, &shortcut) {
        if !unchanged {
            let _ = manager.unregister(shortcut.as_str());
        }
        return Err(error.to_string());
    }
    if !unchanged && status.registered {
        let _ = manager.unregister(status.shortcut.as_str());
    }
    *status = ShortcutStatus {
        shortcut,
        registered: true,
    };
    Ok(status.clone())
}

/// Desativa o atalho enquanto o cadastro grava uma combinação, para que ele também
/// possa ser pressionado.
pub fn suspend_shortcut(app: &AppHandle) -> ShortcutStatus {
    let mut status = lock_shortcut(app);
    if status.registered {
        let _ = app.global_shortcut().unregister(status.shortcut.as_str());
        status.registered = false;
    }
    status.clone()
}

/// Reativa o atalho configurado, se ele não estiver registrado.
pub fn resume_shortcut(app: &AppHandle) -> ShortcutStatus {
    let mut status = lock_shortcut(app);
    if !status.registered {
        status.registered = app
            .global_shortcut()
            .register(status.shortcut.as_str())
            .is_ok();
    }
    status.clone()
}

fn toggle(app: &AppHandle) {
    let Some(window) = app.get_webview_window(PICKER_WINDOW) else {
        return;
    };
    // Falhas aqui não têm tratamento útil: no pior caso o menu não aparece.
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = show(app);
    }
}

fn show(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(PICKER_WINDOW) else {
        return Ok(());
    };
    paste::remember_target(app);
    let cursor = app.cursor_position()?;
    let Some(monitor) = app
        .monitor_from_point(cursor.x, cursor.y)?
        .or(app.primary_monitor()?)
    else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let size = LogicalSize::new(WIDTH, HEIGHT).to_physical::<i32>(scale);
    let work_area = monitor.work_area();
    let area = Area {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width as i32,
        height: work_area.size.height as i32,
    };
    let (x, y) = place(
        (cursor.x as i32, cursor.y as i32),
        (size.width, size.height),
        area,
    );
    let main = MainColumn {
        rect: Area {
            x,
            y,
            width: size.width,
            height: size.height,
        },
        work_area: area,
        scale,
    };
    // A janela ocupa a área útil e não muda até fechar: as colunas abrem dentro dela, e só
    // a região muda. Ela aparece com a região vazia, invisível, até o menu desenhar a raiz;
    // assim o conteúdo da abertura anterior não aparece.
    window.set_position(PhysicalPosition::new(area.x, area.y))?;
    window.set_size(PhysicalSize::new(
        work_area.size.width,
        work_area.size.height,
    ))?;
    set_region(&window, &[])?;
    let count = {
        let mut opening = lock_opening(app);
        opening.main = Some(main);
        opening.count += 1;
        opening.waiting = true;
        opening.count
    };
    app.emit_to(PICKER_WINDOW, PICKER_OPENED, main.arrange(&[]).columns[0])?;
    window.show()?;
    window.set_focus()?;
    // Se o aviso do menu não chegar, a coluna principal aparece mesmo assim.
    let handle = app.clone();
    thread::spawn(move || {
        thread::sleep(READY_TIMEOUT);
        let app = handle.clone();
        let _ = handle.run_on_main_thread(move || reveal(&app, Some(count)));
    });
    Ok(())
}

fn lock_opening(app: &AppHandle) -> MutexGuard<'_, Opening> {
    app.state::<PickerGeometry>()
        .inner()
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

/// O menu desenhou a raiz da abertura atual: a coluna principal passa a aparecer.
pub fn ready(app: &AppHandle) {
    reveal(app, None);
}

/// Aplica a região da coluna principal se a abertura (`count`, ou a atual quando `None`)
/// ainda espera por ela.
fn reveal(app: &AppHandle, count: Option<u64>) {
    let main = {
        let mut opening = lock_opening(app);
        if !opening.waiting || count.is_some_and(|count| count != opening.count) {
            return;
        }
        opening.waiting = false;
        opening.main
    };
    if let (Some(main), Some(window)) = (main, app.get_webview_window(PICKER_WINDOW)) {
        let _ = set_region(&window, &main.arrange(&[]).region);
    }
}

/// Recorta a janela do menu nas colunas visíveis e devolve a posição de cada coluna,
/// relativa à janela. A janela em si não muda de tamanho nem de lugar.
pub fn layout(app: &AppHandle, subs: &[Subcolumn]) -> Result<Vec<PlacedColumn>, String> {
    let window = app
        .get_webview_window(PICKER_WINDOW)
        .ok_or("o menu de colagem não existe")?;
    let main = {
        let mut opening = lock_opening(app);
        // A região passa a ser a destas colunas; o aviso de pronto não a substitui mais.
        opening.waiting = false;
        opening.main
    }
    .ok_or("o menu de colagem ainda não foi aberto")?;
    let arrangement = main.arrange(subs);
    set_region(&window, &arrangement.region).map_err(|error| error.to_string())?;
    Ok(arrangement.columns)
}

/// Limita o desenho e o clique da janela à união dos retângulos (pixels físicos relativos
/// à janela); fora deles, o clique vai para o programa de trás. Sem retângulos, a janela
/// fica invisível.
#[cfg(windows)]
fn set_region(window: &WebviewWindow, rects: &[Area]) -> tauri::Result<()> {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, RGN_OR, SetWindowRgn,
    };

    let hwnd = window.hwnd()?;
    unsafe {
        let region = CreateRectRgn(0, 0, 0, 0);
        for rect in rects {
            let part = CreateRectRgn(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
            CombineRgn(Some(region), Some(region), Some(part), RGN_OR);
            let _ = DeleteObject(part.into());
        }
        // Aceita pela janela, a região passa a pertencer ao Windows e não deve ser apagada.
        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            let _ = DeleteObject(region.into());
            return Err(tauri::Error::Io(std::io::Error::last_os_error()));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
fn set_region(_window: &WebviewWindow, _rects: &[Area]) -> tauri::Result<()> {
    Ok(())
}

/// Grava a navegação nas pastas (`cascade` ou `click`); vale na próxima abertura do menu.
pub fn change_navigation(conn: &Connection, navigation: &str) -> Result<String, String> {
    if navigation != settings::NAVIGATION_CASCADE && navigation != settings::NAVIGATION_CLICK {
        return Err("navegação inválida: use cascade ou click".to_string());
    }
    settings::set_setting(conn, settings::PICKER_NAVIGATION, navigation)
        .map_err(|error| error.to_string())?;
    Ok(navigation.to_string())
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PICKER_WINDOW) {
        let _ = window.hide();
    }
}

/// O menu fecha ao perder o foco (clique fora) e nunca é destruído: Alt+F4 apenas o oculta.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != PICKER_WINDOW {
        return;
    }
    match event {
        WindowEvent::Focused(false) => {
            let _ = window.hide();
        }
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = window.hide();
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Area = Area {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    };
    const SIZE: (i32, i32) = (340, 440);

    #[test]
    fn opens_at_the_cursor_when_it_fits() {
        assert_eq!(place((100, 200), SIZE, AREA), (100, 200));
    }

    #[test]
    fn opens_to_the_left_near_the_right_edge() {
        assert_eq!(place((1800, 200), SIZE, AREA), (1460, 200));
    }

    #[test]
    fn opens_upward_near_the_bottom_edge() {
        assert_eq!(place((100, 900), SIZE, AREA), (100, 460));
    }

    #[test]
    fn stays_inside_the_area_when_neither_side_fits() {
        let area = Area {
            x: 0,
            y: 0,
            width: 1920,
            height: 600,
        };
        assert_eq!(place((100, 300), SIZE, area), (100, 160));
    }

    #[test]
    fn respects_monitors_with_negative_coordinates() {
        let left = Area {
            x: -1280,
            y: 0,
            width: 1280,
            height: 984,
        };
        assert_eq!(place((-100, 50), SIZE, left), (-440, 50));
        assert_eq!(place((-1280, 900), SIZE, left), (-1280, 460));
    }

    #[test]
    fn navigation_accepts_only_the_two_modes() {
        let conn = crate::db::open_in_memory().unwrap();

        assert_eq!(change_navigation(&conn, "click").unwrap(), "click");
        assert_eq!(settings::get_navigation(&conn).unwrap(), "click");
        assert!(change_navigation(&conn, "hover").is_err());
        assert_eq!(settings::get_navigation(&conn).unwrap(), "click");
        assert_eq!(change_navigation(&conn, "cascade").unwrap(), "cascade");
        assert_eq!(settings::get_navigation(&conn).unwrap(), "cascade");
    }

    #[test]
    fn normalizes_accepted_combinations() {
        assert_eq!(normalize_shortcut("Alt+KeyQ").unwrap(), "Alt+KeyQ");
        assert_eq!(
            normalize_shortcut("shift+control+Space").unwrap(),
            "Ctrl+Shift+Space"
        );
        assert_eq!(
            normalize_shortcut("Shift+Alt+Ctrl+Digit5").unwrap(),
            "Ctrl+Alt+Shift+Digit5"
        );
        assert_eq!(normalize_shortcut("Ctrl+F12").unwrap(), "Ctrl+F12");
        assert_eq!(
            normalize_shortcut(DEFAULT_SHORTCUT).unwrap(),
            DEFAULT_SHORTCUT
        );
    }

    #[test]
    fn rejects_combinations_outside_the_rules() {
        for text in [
            "KeyQ",
            "Shift+KeyQ",
            "Super+KeyQ",
            "Ctrl+Super+KeyQ",
            "Alt+Alt+KeyQ",
            "Alt+Q",
            "Alt+Keyq",
            "Alt+F13",
            "Alt+F0",
            "Alt+F01",
            "Alt+Enter",
            "Alt+",
            "Alt+KeyQ+KeyW",
            "",
        ] {
            assert!(
                normalize_shortcut(text).is_err(),
                "{text} deveria ser recusado"
            );
        }
    }

    #[test]
    fn keeps_the_start_visible_in_an_area_smaller_than_the_menu() {
        let tiny = Area {
            x: 0,
            y: 0,
            width: 300,
            height: 400,
        };
        assert_eq!(place((150, 150), SIZE, tiny), (0, 0));
    }
}

//! Menu de colagem: janela `picker` aberta pelo atalho global junto ao cursor do mouse.

use tauri::plugin::TauriPlugin;
use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Runtime, Window, WindowEvent,
    Wry,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const PICKER_WINDOW: &str = "picker";
const SHORTCUT: &str = "Alt+Q";
/// Tamanho lógico do menu, o mesmo declarado em `tauri.conf.json`.
const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 440.0;

/// Evento enviado ao menu a cada abertura, para que volte à raiz e recarregue os dados.
const PICKER_OPENED: &str = "picker-opened";

/// Mensagem exibida no cadastro quando o atalho não pôde ser registrado.
pub struct ShortcutError(pub Option<String>);

/// Retângulo em pixels físicos, como a área útil de um monitor.
#[derive(Debug, Clone, Copy)]
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

/// Registra o atalho; a falha (por exemplo, atalho já usado por outro programa) não
/// impede o aplicativo de abrir e fica disponível para o cadastro exibir.
pub fn register_shortcut(app: &App) {
    let error = app.global_shortcut().register(SHORTCUT).err().map(|error| {
        format!(
            "O atalho {SHORTCUT} não pôde ser registrado; outro programa pode estar usando-o. ({error})"
        )
    });
    app.manage(ShortcutError(error));
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
    let cursor = app.cursor_position()?;
    if let Some(monitor) = app.monitor_from_point(cursor.x, cursor.y)? {
        let size = LogicalSize::new(WIDTH, HEIGHT).to_physical::<i32>(monitor.scale_factor());
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
        window.set_position(PhysicalPosition::new(x, y))?;
        // Ao passar para um monitor com outra escala, o tamanho lógico é reaplicado.
        window.set_size(LogicalSize::new(WIDTH, HEIGHT))?;
    }
    app.emit_to(PICKER_WINDOW, PICKER_OPENED, ())?;
    window.show()?;
    window.set_focus()
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PICKER_WINDOW) {
        let _ = window.hide();
    }
}

/// Entrega o texto escolhido. Por enquanto, copia para o clipboard e fecha o menu.
pub fn deliver(app: &AppHandle, content: &str) -> Result<(), String> {
    app.clipboard()
        .write_text(content)
        .map_err(|error| format!("não foi possível copiar o texto: {error}"))?;
    hide(app);
    Ok(())
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

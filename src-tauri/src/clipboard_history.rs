//! Monitor do histórico do clipboard. No Windows, uma janela só de mensagens, numa thread
//! própria, recebe o aviso de cada mudança do clipboard (`AddClipboardFormatListener`) e
//! lê o conteúdo; outra thread converte as imagens, grava no banco e avisa as janelas.
//! A janela fica ativa mesmo com o histórico desligado: ela também é a dona do clipboard
//! nas escritas do CSTM, que assim são reconhecidas e ignoradas.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager};

use crate::clipboard::Captured;
use crate::db;

/// Evento emitido quando o histórico muda (item novo, uso, limpeza ou opção alterada).
pub const CHANGED_EVENT: &str = "clipboard-history-changed";

static ENABLED: AtomicBool = AtomicBool::new(false);

/// Inicia o monitor; `enabled` vem da configuração `clipboard_history`.
pub fn start(app: &AppHandle, enabled: bool) {
    set_enabled(enabled);
    platform::start(app.clone());
}

/// Liga ou desliga a gravação na hora, sem apagar o que já foi guardado.
pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

#[cfg_attr(not(windows), allow(dead_code))]
fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

pub fn notify(app: &AppHandle) {
    let _ = app.emit(CHANGED_EVENT, ());
}

/// Guarda o item lido; um item que não pôde ser convertido ou gravado é descartado.
#[cfg_attr(not(windows), allow(dead_code))]
fn record(app: &AppHandle, captured: Captured) {
    let Some(content) = captured.into_content() else {
        return;
    };
    let state = app.state::<Mutex<Connection>>();
    let mut conn = state.lock().unwrap_or_else(PoisonError::into_inner);
    let recorded = db::clipboard::record(&mut conn, &content).is_ok();
    drop(conn);
    if recorded {
        notify(app);
    }
}

#[cfg(windows)]
mod platform {
    use std::sync::OnceLock;
    use std::sync::mpsc::{self, Sender};
    use std::thread;

    use tauri::AppHandle;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::DataExchange::AddClipboardFormatListener;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, HWND_MESSAGE, MSG,
        RegisterClassW, WINDOW_EX_STYLE, WINDOW_STYLE, WM_CLIPBOARDUPDATE, WNDCLASSW,
    };
    use windows::core::w;

    use crate::clipboard::{self, Captured};

    /// Fila entre a thread da janela e a que grava no banco.
    static CAPTURED: OnceLock<Sender<Captured>> = OnceLock::new();

    unsafe extern "system" fn window_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message != WM_CLIPBOARDUPDATE {
            return unsafe { DefWindowProcW(window, message, wparam, lparam) };
        }
        // A leitura acontece aqui, logo após o aviso; a conversão e o banco ficam com a
        // outra thread, para a janela voltar logo a atender o Windows.
        if super::enabled()
            && !clipboard::written_by_cstm()
            && let Some(captured) = clipboard::read()
            && let Some(sender) = CAPTURED.get()
        {
            let _ = sender.send(captured);
        }
        LRESULT(0)
    }

    pub fn start(app: AppHandle) {
        let (sender, receiver) = mpsc::channel();
        if CAPTURED.set(sender).is_err() {
            return;
        }
        let _ = thread::Builder::new()
            .name("clipboard-history".into())
            .spawn(move || {
                for captured in receiver {
                    super::record(&app, captured);
                }
            });
        let _ = thread::Builder::new()
            .name("clipboard-monitor".into())
            .spawn(listen);
    }

    fn listen() {
        unsafe {
            let Ok(module) = GetModuleHandleW(None) else {
                return;
            };
            let class = w!("CstmClipboardMonitor");
            let window_class = WNDCLASSW {
                lpfnWndProc: Some(window_proc),
                hInstance: module.into(),
                lpszClassName: class,
                ..Default::default()
            };
            if RegisterClassW(&window_class) == 0 {
                return;
            }
            let Ok(window) = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                class,
                w!("CSTM"),
                WINDOW_STYLE::default(),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                Some(module.into()),
                None,
            ) else {
                return;
            };
            clipboard::set_owner(window.0 as isize);
            // Mesmo sem o aviso de mudanças, a janela continua atendendo mensagens: como
            // dona do clipboard, ela as recebe dos outros programas.
            let _ = AddClipboardFormatListener(window);
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                DispatchMessageW(&message);
            }
        }
    }
}

/// Fora do Windows não há histórico.
#[cfg(not(windows))]
mod platform {
    use tauri::AppHandle;

    pub fn start(_app: AppHandle) {}
}

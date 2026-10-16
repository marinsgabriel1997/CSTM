//! Colagem do item escolhido (um texto cadastrado ou um item do histórico) no programa que
//! estava ativo quando o menu abriu: reativa essa janela, troca o clipboard pelo item,
//! simula `Ctrl+V` e, conforme a configuração, devolve o conteúdo anterior (texto com
//! HTML/RTF ou imagem) ou mantém o item colado. A cópia faz o mesmo sem o `Ctrl+V`,
//! deixando o item no clipboard.

use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Manager};

use crate::clipboard::{self, Content};
use crate::db::settings::AfterPaste;
use crate::picker;

/// Estado da colagem, gerenciado pelo Tauri.
#[derive(Default)]
pub struct PasteState {
    /// Janela ativa quando o menu abriu (`HWND` como inteiro).
    target: Mutex<Option<isize>>,
    /// Serializa as colagens, para que uma não restaure o clipboard no meio de outra.
    running: Mutex<()>,
}

/// Conteúdo a devolver ao clipboard: o anterior, se foi capturado e se o clipboard ainda
/// contém o que o CSTM escreveu (o número de sequência do Windows não mudou).
fn content_to_restore<T>(previous: Option<T>, written: u32, current: u32) -> Option<T> {
    previous.filter(|_| written == current)
}

/// Guarda a janela ativa; chamado antes de mostrar o menu.
pub fn remember_target(app: &AppHandle) {
    *lock_target(app) = platform::foreground();
}

fn lock_target(app: &AppHandle) -> MutexGuard<'_, Option<isize>> {
    app.state::<PasteState>()
        .inner()
        .target
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

/// Cola o item na janela guardada e fecha o menu. Se a janela não puder ser reativada,
/// o item apenas fica no clipboard, para ser colado manualmente. Retorna se colou.
/// Com `AfterPaste::Restore`, o clipboard anterior volta depois da colagem.
pub fn paste(app: &AppHandle, content: &Content, after: AfterPaste) -> Result<bool, String> {
    let state = app.state::<PasteState>();
    let _running = state
        .inner()
        .running
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    let target = lock_target(app).take();
    // A janela anterior é reativada antes de o menu sumir: enquanto o menu está em
    // primeiro plano, o Windows permite ao CSTM escolher a próxima janela ativa.
    let focused = target.is_some_and(platform::activate);
    picker::hide(app);
    if !focused {
        clipboard::write(app, content)?;
        return Ok(false);
    }

    // Restaurar devolve uma cópia bruta de texto (com HTML/RTF) ou imagem, sem decodificar
    // nada antes do `Ctrl+V`; arquivos do Explorer e outros formatos não voltam. Só se
    // copia quando vai restaurar. Sem nada copiado, o item colado fica no clipboard.
    let previous = match after {
        AfterPaste::Restore => clipboard::snapshot(),
        AfterPaste::Keep => None,
    };
    clipboard::write(app, content)?;
    let written = platform::clipboard_sequence();
    platform::wait_for_modifiers_release();
    if !platform::send_ctrl_v() {
        return Ok(false);
    }
    if after == AfterPaste::Restore {
        std::thread::sleep(platform::RESTORE_DELAY);
        if let Some(previous) =
            content_to_restore(previous, written, platform::clipboard_sequence())
        {
            // A colagem já aconteceu; uma falha aqui só deixa o item colado no clipboard.
            let _ = clipboard::restore(app, &previous);
        }
    }
    Ok(true)
}

/// Deixa o item no clipboard, sem colar e sem restaurar o anterior; o menu fecha e o
/// foco volta à janela guardada, se ela ainda existir.
pub fn copy(app: &AppHandle, content: &Content) -> Result<(), String> {
    let state = app.state::<PasteState>();
    // Espera uma colagem em andamento terminar de restaurar o clipboard.
    let _running = state
        .inner()
        .running
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    let target = lock_target(app).take();
    // Como na colagem, a janela anterior é reativada antes de o menu sumir.
    if let Some(window) = target {
        platform::activate(window);
    }
    picker::hide(app);
    clipboard::write(app, content)
}

#[cfg(windows)]
mod platform {
    use std::thread;
    use std::time::{Duration, Instant};

    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT,
        KEYEVENTF_KEYUP, SendInput, VIRTUAL_KEY, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
        VK_V,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, IsWindow, SetForegroundWindow,
    };

    /// Espera entre o `Ctrl+V` e a restauração do clipboard, para que o programa de
    /// destino leia o texto colado antes de ele ser trocado de volta.
    pub const RESTORE_DELAY: Duration = Duration::from_millis(500);
    const FOCUS_TIMEOUT: Duration = Duration::from_millis(500);
    const MODIFIERS_TIMEOUT: Duration = Duration::from_secs(1);
    const POLL_INTERVAL: Duration = Duration::from_millis(10);

    fn wait_until(timeout: Duration, condition: impl Fn() -> bool) -> bool {
        let start = Instant::now();
        while !condition() {
            if start.elapsed() >= timeout {
                return false;
            }
            thread::sleep(POLL_INTERVAL);
        }
        true
    }

    fn hwnd(value: isize) -> HWND {
        HWND(value as *mut _)
    }

    pub fn foreground() -> Option<isize> {
        let window = unsafe { GetForegroundWindow() };
        (!window.is_invalid()).then_some(window.0 as isize)
    }

    /// Reativa a janela e aguarda o Windows confirmá-la em primeiro plano.
    pub fn activate(window: isize) -> bool {
        unsafe {
            if !IsWindow(Some(hwnd(window))).as_bool()
                || !SetForegroundWindow(hwnd(window)).as_bool()
            {
                return false;
            }
        }
        wait_until(FOCUS_TIMEOUT, || foreground() == Some(window))
    }

    pub fn clipboard_sequence() -> u32 {
        unsafe { GetClipboardSequenceNumber() }
    }

    /// Aguarda que as modificadoras ainda pressionadas sejam soltas; caso contrário, o
    /// `Ctrl+V` simulado viraria outra combinação (por exemplo, `Ctrl+Alt+V`).
    pub fn wait_for_modifiers_release() {
        let pressed = |key: VIRTUAL_KEY| unsafe { GetAsyncKeyState(i32::from(key.0)) } < 0;
        wait_until(MODIFIERS_TIMEOUT, || {
            ![VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN]
                .into_iter()
                .any(pressed)
        });
    }

    pub fn send_ctrl_v() -> bool {
        let key = |key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: key,
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        };
        let down = KEYBD_EVENT_FLAGS(0);
        let inputs = [
            key(VK_CONTROL, down),
            key(VK_V, down),
            key(VK_V, KEYEVENTF_KEYUP),
            key(VK_CONTROL, KEYEVENTF_KEYUP),
        ];
        let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
        sent as usize == inputs.len()
    }
}

/// Fora do Windows não há colagem: o texto apenas fica no clipboard.
#[cfg(not(windows))]
mod platform {
    use std::time::Duration;

    pub const RESTORE_DELAY: Duration = Duration::ZERO;

    pub fn foreground() -> Option<isize> {
        None
    }

    pub fn activate(_window: isize) -> bool {
        false
    }

    pub fn clipboard_sequence() -> u32 {
        0
    }

    pub fn wait_for_modifiers_release() {}

    pub fn send_ctrl_v() -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_the_previous_content_when_the_clipboard_is_untouched() {
        let previous = Content::Text(clipboard::TextContent::plain("anterior"));
        assert_eq!(
            content_to_restore(Some(previous.clone()), 7, 7),
            Some(previous)
        );
    }

    #[test]
    fn keeps_what_was_copied_after_the_paste() {
        assert_eq!(content_to_restore(Some("anterior"), 7, 8), None);
    }

    #[test]
    fn keeps_the_pasted_content_when_nothing_was_captured_before() {
        assert_eq!(content_to_restore(None::<&str>, 7, 7), None);
    }
}

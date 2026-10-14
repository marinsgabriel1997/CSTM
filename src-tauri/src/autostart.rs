//! Iniciar com o Windows: um valor na chave `Run` do usuário aponta para o executável
//! com `--autostart`. A fonte da verdade é o próprio registro, para refletir também a
//! desativação feita no Gerenciador de Tarefas (chave `StartupApproved`).

/// Argumento com que o Windows inicia o CSTM; com ele, o cadastro começa oculto.
pub const ARGUMENT: &str = "--autostart";

/// Nome do valor na chave `Run`; o desinstalador apaga esse mesmo nome.
#[cfg_attr(not(windows), allow(dead_code))]
const VALUE_NAME: &str = "CSTM";

/// Se o processo foi iniciado pelo Windows ao entrar na sessão.
pub fn started_by_windows<I: IntoIterator<Item = String>>(args: I) -> bool {
    args.into_iter().any(|arg| arg == ARGUMENT)
}

/// Linha de comando gravada na chave `Run`, com o caminho entre aspas (pode ter espaços).
#[cfg_attr(not(windows), allow(dead_code))]
fn command_line(exe: &str) -> String {
    format!("\"{exe}\" {ARGUMENT}")
}

/// O Gerenciador de Tarefas marca a entrada como desativada com o primeiro byte ímpar
/// (`03` ou `07`); `02`, `06` ou a ausência do valor significam ativada.
#[cfg_attr(not(windows), allow(dead_code))]
fn approved(flags: Option<&[u8]>) -> bool {
    flags
        .and_then(<[u8]>::first)
        .is_none_or(|first| first & 1 == 0)
}

// Os erros trazem só a causa; a interface diz qual operação falhou.
pub fn is_enabled() -> Result<bool, String> {
    platform::is_enabled()
}

/// Liga ou desliga a entrada e devolve o estado lido do registro em seguida.
pub fn set_enabled(enabled: bool) -> Result<bool, String> {
    if enabled {
        platform::enable()?;
    } else {
        platform::disable()?;
    }
    is_enabled()
}

#[cfg(windows)]
mod platform {
    use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, WIN32_ERROR};
    use windows::Win32::System::Registry::{
        HKEY_CURRENT_USER, REG_BINARY, REG_ROUTINE_FLAGS, REG_SZ, RRF_RT_REG_BINARY, RRF_RT_REG_SZ,
        RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW,
    };
    use windows::core::HSTRING;

    use super::{VALUE_NAME, approved, command_line};

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APPROVED_KEY: &str =
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    /// Valor que o Gerenciador de Tarefas grava ao ativar uma entrada.
    const APPROVED_ENABLED: [u8; 12] = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    fn check(code: WIN32_ERROR) -> windows::core::Result<()> {
        code.ok()
    }

    /// Bytes do valor, ou `None` se ele (ou a chave) não existe.
    fn read(key: &str, flags: REG_ROUTINE_FLAGS) -> windows::core::Result<Option<Vec<u8>>> {
        let (key, name) = (HSTRING::from(key), HSTRING::from(VALUE_NAME));
        let mut size = 0u32;
        let code = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                &key,
                &name,
                flags,
                None,
                None,
                Some(&mut size),
            )
        };
        if code == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        check(code)?;
        let mut data = vec![0u8; size as usize];
        check(unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                &key,
                &name,
                flags,
                None,
                Some(data.as_mut_ptr().cast()),
                Some(&mut size),
            )
        })?;
        data.truncate(size as usize);
        Ok(Some(data))
    }

    fn write(key: &str, kind: u32, data: &[u8]) -> windows::core::Result<()> {
        check(unsafe {
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                &HSTRING::from(key),
                &HSTRING::from(VALUE_NAME),
                kind,
                Some(data.as_ptr().cast()),
                data.len() as u32,
            )
        })
    }

    fn delete(key: &str) -> windows::core::Result<()> {
        let code = unsafe {
            RegDeleteKeyValueW(
                HKEY_CURRENT_USER,
                &HSTRING::from(key),
                &HSTRING::from(VALUE_NAME),
            )
        };
        if code == ERROR_FILE_NOT_FOUND {
            return Ok(());
        }
        check(code)
    }

    pub fn is_enabled() -> Result<bool, String> {
        let registered = read(RUN_KEY, RRF_RT_REG_SZ).map_err(|error| error.message())?;
        if registered.is_none() {
            return Ok(false);
        }
        let flags = read(APPROVED_KEY, RRF_RT_REG_BINARY).map_err(|error| error.message())?;
        Ok(approved(flags.as_deref()))
    }

    pub fn enable() -> Result<(), String> {
        let exe = std::env::current_exe().map_err(|error| error.to_string())?;
        // REG_SZ em UTF-16, terminado em nulo.
        let line: Vec<u8> = command_line(&exe.display().to_string())
            .encode_utf16()
            .chain([0])
            .flat_map(u16::to_le_bytes)
            .collect();
        write(RUN_KEY, REG_SZ.0, &line)
            // Uma desativação anterior no Gerenciador de Tarefas anularia a entrada nova.
            .and_then(|()| write(APPROVED_KEY, REG_BINARY.0, &APPROVED_ENABLED))
            .map_err(|error| error.message())
    }

    pub fn disable() -> Result<(), String> {
        delete(RUN_KEY)
            .and_then(|()| delete(APPROVED_KEY))
            .map_err(|error| error.message())
    }
}

/// Fora do Windows não há inicialização automática.
#[cfg(not(windows))]
mod platform {
    pub fn is_enabled() -> Result<bool, String> {
        Ok(false)
    }

    pub fn enable() -> Result<(), String> {
        Err("disponível somente no Windows".to_string())
    }

    pub fn disable() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_the_autostart_argument() {
        let args = |list: &[&str]| list.iter().map(ToString::to_string).collect::<Vec<_>>();
        assert!(started_by_windows(args(&["cstm.exe", "--autostart"])));
        assert!(!started_by_windows(args(&["cstm.exe"])));
        assert!(!started_by_windows(args(&["cstm.exe", "--autostart=1"])));
    }

    #[test]
    fn quotes_the_executable_path() {
        assert_eq!(
            command_line(r"C:\Users\Ana Maria\AppData\Local\CSTM\cstm.exe"),
            r#""C:\Users\Ana Maria\AppData\Local\CSTM\cstm.exe" --autostart"#
        );
    }

    #[test]
    fn reads_the_task_manager_flag() {
        assert!(approved(None));
        assert!(approved(Some(&[2, 0, 0, 0])));
        assert!(approved(Some(&[6, 0, 0, 0])));
        assert!(!approved(Some(&[3, 1, 2, 3])));
        assert!(!approved(Some(&[7, 1, 2, 3])));
    }
}

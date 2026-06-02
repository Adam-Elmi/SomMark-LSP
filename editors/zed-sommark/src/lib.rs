use zed_extension_api as zed;

struct SomMarkExtension;

impl zed::Extension for SomMarkExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _config: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        Ok(zed::Command {
            command: "/home/adam/.config/nvm/versions/node/v24.13.1/bin/node".to_string(),
            args: vec![
                "/home/adam/Projects/Smark/SomMark-LSP/server/server.js".to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(SomMarkExtension);

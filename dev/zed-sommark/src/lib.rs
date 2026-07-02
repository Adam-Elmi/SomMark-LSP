use zed_extension_api as zed;

struct SomMarkExtension;

impl zed::Extension for SomMarkExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        Ok(zed::Command {
            command: "/usr/bin/node".to_string(),
            args: vec![
                "/home/adam/Projects/SomMark-LSP/server/server.js".to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(SomMarkExtension);

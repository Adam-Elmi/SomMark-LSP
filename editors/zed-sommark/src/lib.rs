use zed_extension_api as zed;

struct SomMarkExtension;

impl zed::Extension for SomMarkExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let server = worktree
            .which("sommark-lsp")
            .ok_or_else(|| "sommark-lsp not found — run: npm install -g sommark-lsp".to_string())?;

        Ok(zed::Command {
            command: server,
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(SomMarkExtension);

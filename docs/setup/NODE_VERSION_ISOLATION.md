# Node Version Isolation Setup

This project uses **Node.js 18** for React Native/Expo compatibility, while you may have Node 24 for other projects. This guide sets up automatic Node version isolation so you never have to manually switch versions.

## The Problem

VanishVoice requires Node 18 for optimal React Native/Expo compatibility, but modern projects often use Node 24. Manual version switching with `nvm use` is tedious and error-prone.

## The Solution: direnv + nodenv

**direnv** automatically loads environment variables when entering a directory.
**nodenv** is a Node version manager optimized for automation (better than nvm for this use case).

When you enter the VanishVoice directory, it automatically switches to Node 18.
When you leave, it reverts to your global Node version.

## Installation (macOS)

### 1. Install Tools
```bash
brew install direnv nodenv
```

### 2. Configure Shell
Add to your `~/.zshrc` (or `~/.bashrc`):
```bash
eval "$(direnv hook zsh)"
eval "$(nodenv init -)"
```

Reload your shell:
```bash
source ~/.zshrc
```

### 3. Install Node 18
```bash
nodenv install 18.20.5
```

### 4. Configure Project (Already Done)
The project includes:
- `.node-version` - Specifies Node 18.20.5
- `.envrc` - Direnv configuration for automatic switching
- `package.json` engines field - Enforces Node version requirements

### 5. Allow Direnv (First Time Only)
When you first enter the VanishVoice directory:
```bash
direnv allow .
```

## How It Works

1. **Enter VanishVoice directory**: Automatically switches to Node 18.20.5
2. **Exit directory**: Reverts to your global Node version
3. **No manual intervention**: Works seamlessly with all development commands

## Verification

Check that it's working:
```bash
# Outside VanishVoice
node --version  # Shows your global version (e.g., v24.4.1)

# Inside VanishVoice
cd /path/to/VanishVoice
node --version  # Shows v18.20.5 automatically
```

## Development Commands

All standard commands work automatically with the correct Node version:
```bash
npm install
npx expo start
npx expo run:ios
npx expo run:android
```

## Troubleshooting

### direnv not working
```bash
# Check if direnv is in your shell config
grep direnv ~/.zshrc

# Manually reload if needed
eval "$(direnv hook zsh)"
direnv reload
```

### Node version not switching
```bash
# Check nodenv status
nodenv version
nodenv versions

# Check if .node-version exists
cat .node-version

# Reinstall Node 18 if needed
nodenv install 18.20.5
```

### Still getting Babel runtime errors
This usually means Node 24 is still being used:
```bash
# Force reload the environment
direnv reload
npm install  # Reinstall dependencies with correct Node version
```

## Benefits

- ✅ **Zero manual intervention** - No more `nvm use` commands
- ✅ **Project isolation** - Each project uses its optimal Node version
- ✅ **Team consistency** - Everyone uses the same Node version automatically
- ✅ **Error prevention** - Eliminates Node version compatibility issues
- ✅ **Seamless workflow** - Works with all development tools

## Alternative Solutions Considered

- **nvm with .nvmrc**: Requires manual `nvm use` each time
- **Docker**: Too heavy for React Native development
- **volta**: Good but less flexible than direnv + nodenv
- **asdf**: Similar to nodenv but more complex for single-language projects

The direnv + nodenv combination provides the best balance of automation, simplicity, and reliability.
# ADR-0005: macOS Quick Look 扩展沙盒签名方案

## 状态

已接受

## 背景

Nomo 在 macOS 上实现了 Quick Look 预览扩展（`NomoQuickLookPreview.appex`），用于在 Finder 中按空格键预览 Markdown 文件。

在 macOS 27（macOS Sequoia 后续版本）上，系统对 Quick Look 扩展引入了**强制沙盒要求**：

- 扩展必须包含 `com.apple.security.app-sandbox` entitlement
- 只有使用**有效 Apple Developer 证书**签名的扩展，才能将 entitlements 正确嵌入 Mach-O 可执行文件
- `codesign --sign -`（adhoc 签名）无法嵌入 entitlements，系统会直接拒绝注册该扩展

日志表现：

```
Extension is not entitled to run in the App Sandbox
```

## 决策

**采用方案 A：使用 Apple Development 开发者证书对扩展进行签名。**

放弃方案 B（临时绕过沙盒），因为 macOS 27 已不再接受无沙盒 entitlements 的 Quick Look 扩展。

## 实施步骤

### 1. 申请免费 Apple Development 证书

#### 方式一：Xcode GUI（最简单）

1. 打开 **Xcode** → **Settings** → **Accounts**
2. 使用 Apple ID 登录
3. 点击 **Manage Certificates…**
4. 点击左下角 **+** → 选择 **Apple Development**
5. 等待证书下载完成

#### 方式二：纯命令行（无需 Xcode）

```bash
# 1. 生成私钥和 CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout ~/Desktop/apple-dev.key \
  -out ~/Desktop/apple-dev.csr \
  -subj "/emailAddress=你的邮箱, CN=你的姓名, C=CN"

# 2. 去 Apple Developer Portal 上传 CSR、下载证书
#    https://developer.apple.com/account/resources/certificates/add
#    选择 Apple Development → 上传 apple-dev.csr → 下载 AppleDevelopment.cer

# 3. 导入证书到登录钥匙串
security import ~/Desktop/AppleDevelopment.cer \
  -k ~/Library/Keychains/login.keychain-db

# 4. 导入私钥（绑定证书与私钥，形成可用身份）
security import ~/Desktop/apple-dev.key \
  -k ~/Library/Keychains/login.keychain-db
```

### 2. 验证证书已安装

```bash
security find-identity -v -p codesigning
```

应输出类似：

```
  1) ABC123DEF456 "Apple Development: your@email.com (TEAM_ID)"
     1 valid identity found
```

记下完整的证书名称（含 TEAM_ID），下一步要用。

### 3. 配置构建环境

设置环境变量，让构建脚本自动使用该证书：

```bash
export APPLE_CODESIGN_IDENTITY="Apple Development: your@email.com (TEAM_ID)"
```

或在 `~/.zshrc` / `~/.bash_profile` 中永久添加，避免每次手动输入。

### 4. 重新构建

```bash
pnpm run build:macos
```

构建脚本（`scripts/build-macos-quicklook.sh`）会自动检测 `APPLE_CODESIGN_IDENTITY`，并用该证书对 appex 签名并嵌入 entitlements。

### 4. 首次运行与信任

构建完成后：

1. 将 `Nomo.app` 复制到 `/Applications/`
2. 首次启动时，右键 **Nomo.app** → **打开**（绕过 Gatekeeper）
3. 前往 **系统设置 → 隐私与安全性 → 扩展 → 快速查看**，勾选 **Nomo Quick Look**

### 5. 验证扩展已注册

```bash
pluginkit -m -p com.apple.quicklook.preview | grep nomo
```

应输出包含 `com.nomo.desktop.quicklook` 的记录。

## 影响

- **开发环境**：所有 macOS 开发成员都需要配置 Apple Development 证书才能本地测试 Quick Look 扩展
- **CI/CD**：如果未来引入自动化构建，需要配置证书和 provisioning profile
- **发布**：App Store 或公证（notarization）分发时，需使用 **Apple Distribution** 证书替换开发证书

## 相关文件

- `src-tauri/macos/NomoQuickLookPreview/Info.plist`
- `src-tauri/macos/NomoQuickLookPreview/NomoQuickLookPreview.entitlements`
- `src-tauri/macos/NomoQuickLookPreview/PreviewViewController.swift`
- `src-tauri/macos/NomoQuickLookPreview/main.swift`
- `scripts/build-macos-quicklook.sh`
- `scripts/embed-quicklook-extension.sh`
- `package.json`

# Mentor Vault

Mentor Vault 是一个本地桌面端导师资料工具，用来像表格一样记录导师、学校、研究方向、联系状态和套磁进展。

## 主要功能

- 老师信息管理：姓名、学校、职称、邮箱、主页、研究方向、状态、标签和备注。
- 按状态整理：在导师资料中按状态查看和筛选记录。
- 院校分组：单独的院校分组视图，可以查看每个学校已联系的老师和对应进展。
- 进展时间线：为每位老师记录初次联系、跟进、回复、备注等事件。
- 本地数据存储：用户数据保存在电脑本地，安装包和 GitHub Release 不包含用户个人数据。
- 导入导出：支持从表格导入老师记录，也支持导出记录。
- 半自动更新：程序可以读取公开的 `latest.json`，发现新版本后下载新版安装程序。

## 致谢

感谢原项目 [duck-lite/vibe_sender](https://github.com/duck-lite/vibe_sender) 提供的基础思路和项目参考。

## 下载和安装

普通用户请到 Releases 页面下载最新版安装程序：

```text
https://github.com/Luofaiz/mentor-vault-releases/releases/latest
```

下载 `MentorVaultSetup.exe` 后运行安装即可。

## 开发运行

安装依赖：

```powershell
npm install
```

网页开发模式：

```powershell
npm run dev
```

桌面开发模式：

```powershell
npm run dev:desktop
```

构建 Windows 安装程序：

```powershell
npm run build:desktop:installer
```

生成的安装包位于：

```text
release/installer/MentorVaultSetup.exe
```

## 更新发布

程序内置的更新清单地址：

```text
https://github.com/Luofaiz/mentor-vault-releases/releases/latest/download/latest.json
```

发布新版本时需要：

1. 更新 `package.json` 和 `package-lock.json` 中的版本号。
2. 重新构建 `MentorVaultSetup.exe`。
3. 更新仓库根目录的 `latest.json`。
4. 创建新的 GitHub Release，并上传 `MentorVaultSetup.exe`。

## 数据位置

用户数据保存在系统应用数据目录下的 `Mentor Vault` 文件夹中。卸载或安装新版本不会主动删除用户数据。

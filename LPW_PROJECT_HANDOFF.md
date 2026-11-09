# Real-time LPW 项目交接与上下文恢复

> 新会话开始时先读本文件，再读 `lpw/pipeline/README.md`，然后执行 `git status --short`。
> 最近整理：2026-11-09（Asia/Shanghai）。
> 整理时分支：`main`。
> 整理前 HEAD：`5d39040ae1ce0b69e1a9522a55bd331abb8bb982`。
> 整理前工作区干净；整理后只有本文件等待提交。

## 1. 一分钟恢复当前状态

- 线上页面：`https://wuyuhao.top/lpw/`
- 仓库：`https://github.com/wyhgnss/wyhgnss.github.io`
- 本地仓库：`C:\Users\Administrator\Documents\GitHub\wyhgnss.github.io`
- 默认分支：`main`
- 页面语言：英文；不要随意更改品牌、层定义和科学术语。
- MIMIC 实时浏览数据：最近72小时、1°网格，保存在 Git 分支的 `lpw/data/frames/`。
- MIMIC 下载产品：全球0.25° NetCDF，保存在按月建立的 GitHub Releases 中。
- GNSS 历史数据：静态压缩数据，地图选点后浏览器端导出 TXT。
- 腾讯云 COS 和 Cloudflare Worker 已从仓库移除，不再是系统依赖，不要恢复相关 SDK、Secrets、Variables 或旧上传代码。
- 腾讯云 SCF 是唯一自动调度器；每5分钟检查 MIMIC 源站，仅在发现未发布新时次且没有活动工作流时触发 Actions。
- 修改前端文件后必须递增对应 HTML 中的缓存查询参数。
- 当前 Codex 环境通常不能写仓库 `.git`；若提交失败，由用户通过 GitHub Desktop 提交和推送。

## 2. 必须保留的科学定义

### 2.1 三层定义

- Low：surface–900 hPa。
- Middle：900–700 hPa。
- High：700–300 hPa。

### 2.2 模型逻辑

MATLAB 原始逻辑：

```matlab
[pl, pm, ph] = getP(LAT2, LON2, DOY2, PSHAX_COEFF);
[LPW_Low, LPW_Mid, LPW_High] = getLPW(pl, pm, ph, LAT2, LON2, H2, DOY2, TPW2);
```

Python 实现：`lpw/pipeline/lpw_model.py`。

- 周期项：`[1, cos(phase), sin(phase), cos(2 phase), sin(2 phase)]`。
- `phase = DOY / 365.25 × 2π`。
- XGBoost 输入顺序固定：`latitude, longitude, elevation, day_of_year, TPW`。
- XGBoost 输出顺序固定：`low, middle, high` 残差。
- 初始层值为 `p × TPW`，最终值为 `p × TPW + residual`。
- 无效 TPW 必须保持为 `NaN`。

模型资产位于 `lpw/pipeline/model/`：

- `pshax_coefficients.npz`
- `residual_model.ubj`
- `mimic_grid.npz`

当前模型指纹：`8ef88f351066a8de`。模型资产约84.6 MB，随公开仓库公开。不要把原始 `.mat` 或 GPU pickle 直接放入 Actions。

## 3. 当前数据架构

### 3.1 MIMIC 数据源

- 根目录：`https://bin.ssec.wisc.edu/pub/mtpw2/data/`
- 文件：`compYYYYMMDD.HH0000.nc`
- 原始网格：0.25°，721 × 1440。
- 数据源偶尔返回 502；管线已对 `429/500/502/503/504` 重试。

### 3.2 最近72小时浏览数据

生成器：`lpw/pipeline/update_data.py`。

- 清单：`lpw/data/manifest.json`
- 帧：`lpw/data/frames/YYYYMMDDTHHMMSSZ.bin.gz`
- 显示网格：181 × 360（1°，`stride=4`）。
- 数据顺序：Low、Middle、High，little-endian `int16`。
- 比例：`0.01 mm`；缺测值：`-32768`。
- 浏览器端由 `lpw/assets/lpw.js` 解码。

### 3.3 全球0.25° NetCDF Release 档案

相关文件：

- `lpw/pipeline/github_release_archive.py`：选择最新未归档时次、运行完整0.25°推理并更新索引。
- `lpw/pipeline/netcdf_product.py`：写 CF-1.10 NetCDF-4。
- `lpw/data/mimic-archive.json`：根索引。
- `lpw/data/mimic-releases/<year>.json`：年度小型索引。

Release 规则：

```text
tag:   mimic-lpw-YYYY-MM
asset: mimic_lpw_0p25_YYYYMMDDTHHMMSSZ.nc
```

- 每个文件包含一个 UTC 时次以及 `lpw_low`、`lpw_middle`、`lpw_high`。
- 三层使用压缩 `int16`、`0.01 mm` scale factor、`-32768` 缺测值。
- 每月一个 Release，避免超过单个 Release 1000 个资产的限制。
- 二进制 NC 不进入 Git 历史；Git 中只保存小型 JSON 索引。
- 整理时索引有2个 GitHub Release 产品：`2026-11-07T11:00:00Z` 至 `2026-11-07T14:00:00Z`。
- 不再从 COS 导入旧清单，不应重新加入任何 COS URL。

### 3.4 GNSS 历史数据

- 原始文件：`H:\LPW模型\GNSSLPW.mat`
- 发布目录：`lpw/data/gnss/`
- `manifest.json`：时间、偏移、站名和经纬度。
- `observations.bin.gz`：稀疏压缩观测。
- 导出脚本：`lpw/pipeline/export_gnss_history.m`
- 验证：`lpw/pipeline/test_gnss_export.py`
- 原始 `TIME2` 没有时区元数据，页面只能写 dataset time / time zone unspecified，不能擅自改成 UTC 或北京时间。

## 4. GitHub Actions

工作流：`.github/workflows/update-lpw.yml`，名称 `Update real-time LPW`。

权限：

```yaml
permissions:
  contents: write
  pages: write
```

触发方式：

```yaml
workflow_dispatch:
```

GitHub Actions 自带的 `schedule` 已关闭；原45分钟新鲜度门限也已删除。自动运行完全由腾讯云 SCF 的源站感知调度器发起。

主要流程：

1. 拉取默认分支最新内容。
2. 安装 `lpw/pipeline/requirements.txt`。
3. 运行 `test_lpw_model.py`。
4. 运行 `github_release_archive.py --hours 96`，每次最多准备一个最新 NC。
5. 使用内置 `${{ github.token }}` 和 `gh release upload` 创建或更新月度 Release。
6. 运行 `update_data.py --hours 72 --max-new 1` 更新1°滚动数据。
7. `github-actions[bot]` 提交 `lpw/data` 并请求 Pages 重建。

注意：

- 网页手动 **Run workflow** 会直接执行完整更新；`force` 输入仅为调度器兼容性保留。
- SCF 发现未发布新时次后发送 `force=true`；Actions 不再重复判断45分钟新鲜度。
- 工作流使用 `concurrency: update-lpw`，并由 SCF 在触发前检查是否已有排队或运行中的同一工作流。
- 不要在 Actions 正在提交 `lpw/data` 时手动修改同一批 JSON/帧文件，容易产生 rebase 冲突。

### 4.1 2026-11-07 JSON 冲突事故

`lpw/data/mimic-archive.json` 曾被提交 Git 的 current-branch、separator 和 incoming-branch 三类冲突标记，导致 `github_release_archive.py` 报 `JSONDecodeError`。已修复，同时移除了年度索引中残留的6条 COS URL。

以后发生冲突时：

- 不要选择 “Accept both changes”。
- 根索引必须是合法 JSON，`storage` 为 `github-releases`、`archive_base_url` 为空。
- 年度索引只保留实际 GitHub Release URL。
- 推送前执行 `python -m json.tool` 验证两个 JSON，并搜索冲突标记。

## 5. 腾讯云 SCF 自动调度器

源码：`automation/tencent-lpw-scheduler/index.py`。

- 类型：事件函数，不是 Web 函数。
- 入口：`index.main_handler`。
- 建议：Python 3、128 MB、60秒超时、公网访问开启。
- 环境变量：`GITHUB_TOKEN`，Fine-grained PAT 只授权本仓库 `Actions: Read and write`。
- 定时表达式：`0 */5 * * * * *`，每5分钟一次（腾讯七段式 Cron）。
- 每次先读取 MIMIC 最新月目录中的 `compYYYYMMDD.HH0000.nc` 最新时次。
- 再读取公开仓库的 `lpw/data/mimic-archive.json`，若源站时次未更新则返回 `action: up_to_date`，不调用 Actions。
- 若源站有新时次，先查询 `update-lpw.yml` 是否为 `requested/waiting/pending/queued/in_progress`；有活动运行则返回 `action: workflow_active`。
- 只有“源站有新时次且无活动运行”才以 `force=true` 触发工作流，返回 `action: dispatched`。
- 成功响应兼容 GitHub HTTP 200 和 204；HTTP 200 时返回 `workflow_run_id` 和链接。
- 手动测试曾成功触发运行 `42337395702`。
- SCF 已由用户确认定时触发稳定；部署新版 `index.py` 后需在控制台把旧触发器改为上述每5分钟表达式。

仓库已经移除：

- `automation/lpw-scheduler/` Cloudflare Worker 源码。
- 腾讯云 COS SDK、上传模块和测试。
- `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION`、`TENCENT_COS_PUBLIC_BASE_URL` 的 GitHub 配置。

旧腾讯云 SecretId/SecretKey 曾在对话中明文出现，必须在腾讯云 CAM 中撤销，不能重复使用。Cloudflare 控制台中若仍有旧 Worker/PAT，应由用户另行删除；它们已不影响仓库运行。

## 6. 前端和下载页

主要文件：

- `lpw/index.html`
- `lpw/download.html`
- `lpw/assets/lpw.css`
- `lpw/assets/lpw.js`
- `lpw/assets/gnss.js`
- `lpw/assets/download.js`
- `lpw/assets/coastlines.json`

### 6.1 主页面

- Dark/Light 主题写入 `localStorage`。
- MIMIC 有三个 Canvas 平铺图、Plotly 三层3D视图和72小时点位序列。
- GNSS 有三个 Plotly 全球散点图、三层3D站点图和单站完整历史。
- 三层共用固定 `0–40+ mm` 色标，不能分别归一化。
- GNSS 标签和历史标题不显示内部测站号。
- GNSS 默认时刻为 `2023-05-20 00:00`，缺失时回退到最新时刻。
- 主页左上品牌为 `SHAPER / LPW`；页脚说明使用 `the SHAPER model`。
- 下载页左上品牌同样为 `SHAPER / LPW`。

### 6.2 下载页

- 顶部菜单 `Download data` 打开 `lpw/download.html`。
- MIMIC：按年份和 UTC 日期列出 GitHub Release NC 文件。
- MIMIC 产品不显示 SHA-256；UTC 时刻、文件大小和紧凑的 `Download` 按钮在同一行，产品卡片为桌面三列、平板两列、手机一列。
- GNSS：用户直接在地图选择站点，不显示无用站号。
- GNSS TXT 列：`dataset_time`、`low_lpw_mm`、`middle_lpw_mm`、`high_lpw_mm`。
- TXT 为 UTF-8、Tab 分隔，由浏览器现场生成。
- GNSS 下载地图容器使用 `aspect-ratio: 2 / 1`，避免全球地图上下出现大块空白。

整理时缓存版本：

- 主页面 CSS：`assets/lpw.css?v=20261109-2`
- 主页面 MIMIC：`assets/lpw.js?v=20261101-2`
- 主页面 GNSS：`assets/gnss.js?v=20261101-9`
- 下载页 CSS：`assets/lpw.css?v=20261109-2`
- 下载页脚本：`assets/download.js?v=20261109-2`

修改 CSS/JS 后必须更新使用它的 HTML 查询参数，否则线上可能继续使用旧缓存。

## 7. 当前 Python 依赖和测试

`lpw/pipeline/requirements.txt`：

```text
h5py==3.12.1
numpy==2.1.3
requests==2.32.3
xgboost==3.4.1
netCDF4==1.7.5.1.post1
```

不再需要 `boto3`、`cos-python-sdk-v5` 或 Cloudflare/R2 SDK。

常用验证：

```text
cd lpw/pipeline
python -m unittest -v test_lpw_model.py test_github_release_archive.py test_netcdf_product.py test_gnss_export.py

cd ../..
node --check lpw/assets/lpw.js
node --check lpw/assets/gnss.js
node --check lpw/assets/download.js
python -m json.tool lpw/data/mimic-archive.json NUL
python -m json.tool lpw/data/mimic-releases/2026.json NUL
git diff --check
```

本地没有安装 `netCDF4` 时，`test_netcdf_product.py` 会跳过真实 NC 写入测试；GitHub Actions 会按 requirements 安装它。

## 8. 修改和部署规则

1. 先检查 `git status --short`，保留用户已有修改。
2. 只修改任务相关文件，不重新设计整个网站。
3. 不运行会更新 `lpw/data` 的真实管线，除非用户明确要求。
4. 不恢复在线底图或 MIMIC 平铺图缩放/平移。
5. 不改变模型特征顺序、层顺序、网格方向或色标范围。
6. 前端布局修改后在桌面和手机宽度验证。
7. GitHub Pages 使用 `CNAME`，不要删除。
8. `_config.yml` 排除 `lpw/pipeline`；Actions 仍能从仓库检出该目录。
9. 用户通常通过 GitHub Desktop 提交并推送。
10. 推送数据索引前确认没有 `<<<<<<<`、`=======`、`>>>>>>>`。

本地预览：

```text
python -m http.server 8768 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8768/lpw/`。

## 9. 已知限制

- GitHub 定时任务可能延迟或漏触发。
- MIMIC 数据源可能连续返回网络错误。
- 模型转换过程尚未脚本化。
- 模型指纹变化后首次72小时重算会明显变慢。
- 72帧历史首次访问需要下载大量小文件。
- GNSS 下载依赖浏览器 `DecompressionStream`。
- GNSS 源时间没有时区信息。
- GitHub Releases 适合当前约3 MB/小时文件，但每个 Release 最多1000个资产，因此必须保持按月分组。
- Actions 自动写数据与人工推送可能产生冲突。

## 10. 最近修改记录

- 2026-11-06：新增 `Download data` 页面和 GNSS 地图选点 TXT 导出。
- 2026-11-07：MIMIC 0.25° NetCDF 改为月度 GitHub Releases；移除 COS/R2 SDK、COS 上传代码和 Cloudflare Worker 仓库配置。
- 2026-11-07：保留腾讯云 SCF 作为可选外部调度器，兼容 GitHub dispatch HTTP 200/204。
- 2026-11-07：修复 `mimic-archive.json` 中被提交的 Git 冲突标记，并清除年度索引中的旧 COS URL。
- 2026-11-07：GNSS 下载地图改为2:1容器，去除地图上下空白。
- 2026-11-09：主页品牌更新为 `SHAPER / LPW` 和 `SHAPER model`；MIMIC 下载卡片移除 SHA-256 文案并改为三列响应式布局。
- 2026-11-09：下载页品牌同步为 `SHAPER / LPW`；MIMIC 产品卡片改为时间、大小和紧凑下载按钮单行排列。
- 2026-11-09：关闭 Actions 自带定时和45分钟门限；腾讯云 SCF 改为每5分钟检查源站、已发布时次及活动工作流，仅对未发布新产品触发一次更新。

## 11. 推荐的新会话开场提示

> 请先完整阅读仓库根目录的 `LPW_PROJECT_HANDOFF.md` 和 `lpw/pipeline/README.md`，再检查 `git status --short`。以文档中的“当前有效状态”为准，不恢复腾讯 COS、Cloudflare Worker 或旧对象存储代码。只修改我接下来指定的内容，保留模型输入输出、三层定义、网格方向、固定色标和 GitHub Releases 架构；完成后执行相应测试并更新交接文档，不要未经允许提交或推送。

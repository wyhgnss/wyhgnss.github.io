# Real-time LPW 项目交接与上下文恢复报告

> 用途：在新的 Codex/ChatGPT 会话中，先完整阅读本文件，再修改本项目。  
> 最近整理：2026-11-01（Asia/Shanghai）
> 整理时分支：`main`  
> 整理时 HEAD：`d8751e82b9fc7b9436a5b3d19867b1994f435e17`
> 整理时工作区：存在未提交的 LPW 前端与本报告修改，禁止覆盖或还原。

## 1. 新会话快速恢复清单

1. 阅读本文件和 `lpw/pipeline/README.md`。
2. 查看 `git status --short`，不得覆盖或还原用户已有修改。
3. 根据任务只检查相关文件，不要重新设计整个页面。
4. 修改 MIMIC 或 GNSS JavaScript 后，分别递增 `lpw/index.html` 中 `assets/lpw.js?v=...` 或 `assets/gnss.js?v=...` 的缓存版本。
5. 修改 CSS 后递增 `assets/lpw.css?v=...` 的缓存版本。
6. 至少执行：

   ```text
   node --check lpw/assets/lpw.js
   node --check lpw/assets/gnss.js
   git diff --check
   ```

   只有模型或数据管线发生变化时，才需要在 `lpw/pipeline` 目录额外运行 `python -m unittest -v test_lpw_model.py`；GNSS 导出变化时运行 `python -m unittest -v test_gnss_export.py`。
7. 涉及交互和布局时启动本地静态服务器并进行浏览器验证。
8. 除非用户明确要求，不要自动提交、推送、删除历史数据或运行云端工作流。
9. 完成修改后更新本报告中的“当前实现”“已知限制”和“修改记录”。

## 2. 项目身份与路径

- 项目：实时分层可降水量（Layered Precipitable Water, LPW）监测平台。
- 线上地址：`https://wuyuhao.top/lpw/`
- GitHub Pages 原始域名：`https://wyhgnss.github.io/lpw/`
- GitHub 仓库：`https://github.com/wyhgnss/wyhgnss.github.io`
- 本地仓库：`C:\Users\Administrator\Documents\GitHub\wyhgnss.github.io`
- 默认分支：`main`
- 个人主页顶部菜单配置：`_data/navigation.yml`
- LPW 页面入口：`lpw/index.html`
- 页面语言：英文。
- 视觉主题：支持 Dark/Light 双主题、半透明信息卡和真实地球/卫星背景；主题选择保存在浏览器 `localStorage`。

## 3. 科学模型定义

### 3.1 层结定义

- Low layer：surface–900 hPa。
- Middle layer：900–700 hPa。
- High layer：700–300 hPa。

页面中所有标题、图例和三维层名必须保持以上定义。

### 3.2 MATLAB 原始逻辑

原 MATLAB 核心调用：

```matlab
[pl, pm, ph] = getP(LAT2, LON2, DOY2, PSHAX_COEFF);
[LPW_Low, LPW_Mid, LPW_High] = getLPW(pl, pm, ph, LAT2, LON2, H2, DOY2, TPW2);
```

- `getP`：根据周期函数系数和年积日计算三层比例。
- `getLPW`：用 XGBoost 对三层初始 LPW 进行残差修正。
- MIMIC 网格的经纬度和 DEM 固定。
- 初始层值为 `p × TPW`，最终层值为 `p × TPW + residual`。
- XGBoost 输入顺序固定为：`latitude, longitude, elevation, day_of_year, TPW`。
- XGBoost 输出顺序固定为：`low, middle, high` 三个残差。

Python 实现在 `lpw/pipeline/lpw_model.py`：

- 周期项为 `[1, cos(phase), sin(phase), cos(2 phase), sin(2 phase)]`。
- `phase = DOY / 365.25 × 2π`。
- 输出中的无效 TPW 保持为 `NaN`。

## 4. 模型文件与更新规则

### 4.1 用户原始模型位置

- 周期系数：`H:\LPW模型\MIMIC\PSHAX_COEFF.mat`
- XGBoost 模型：`H:\LPW模型\MIMIC\xgb-gpu.pkl`
- 原 MATLAB 案例目录：`H:\LPW模型\MIMIC`

### 4.2 网站使用的转换后模型

目录：`lpw/pipeline/model/`

| 文件 | 用途 | 2026-10-29 SHA-256 |
|---|---|---|
| `pshax_coefficients.npz` | Low/Middle/High 的 5 项周期系数 | `c1bf8774bf3eb183ef7a57fa57f24a49327fd84d332217a49d0240f6d697c4e0` |
| `residual_model.ubj` | 可在 GitHub Actions CPU 环境运行的 XGBoost Booster | `421f1f89bee8e8790a547acd0d19713ef3bcb2e37fe4395b695c67a59175a7db` |
| `mimic_grid.npz` | 固定纬度、经度和高程网格 | `271f9256d5a6521a334649f4cf4add10c060665e2e7a083338a867fbafcf7ee5` |

当前三个文件总计约 84.6 MB。仓库是公开仓库，因此这些模型资产也是公开的。

### 4.3 更新模型时必须遵守

1. 不要把 `.mat` 或 GPU pickle 直接用于 GitHub Actions。
2. 将 MATLAB 系数转换为 `float32` NPZ，并确认 Low/Middle/High 三组数组维度和方向正确。原始系数网格为 0.25°，单层典型形状为 `(5, 721, 1440)`。
3. 将 pickle 中的 XGBoost Booster 导出为 UBJ，并明确配置为 CPU 可推理版本。
4. 保持五个输入特征的顺序和三个输出残差的顺序不变。
5. 对代表性样本比较原模型与 UBJ 模型预测；此前转换验证为逐点一致。
6. 运行 `test_lpw_model.py`。测试包括 MATLAB 参考点的 `getP` 对比和 CPU 网格推理。
7. `update_data.py` 会根据三个模型文件计算 `model_version` 指纹。模型指纹变化后，下一次工作流会清空旧模型帧的逻辑基础并重新计算 72 小时滚动档案；首次运行可能显著变慢。
8. 当前转换过程没有独立脚本保存在仓库中。下次更新模型时，应优先补充可重复的转换脚本，并保留新旧模型一致性验证。

当前 `manifest.json` 中的模型版本指纹为：`8ef88f351066a8de`。

## 5. 数据管线

### 5.1 数据源

- MIMIC-TPW 根目录：`https://bin.ssec.wisc.edu/pub/mtpw2/data/`
- 文件形式：按月份目录组织的 NetCDF，例如 `compYYYYMMDD.HH0000.nc`。
- 源数据分辨率：0.25°。
- 页面发布分辨率：1°，由 `stride=4` 采样得到。

### 5.2 Python 文件

- `lpw/pipeline/update_data.py`：查找、下载、计算、压缩并发布最近 72 小时数据。
- `lpw/pipeline/lpw_model.py`：MATLAB `getP/getLPW` 的 Python 实现。
- `lpw/pipeline/test_lpw_model.py`：模型一致性和 CPU 推理测试。
- `lpw/pipeline/requirements.txt`：固定依赖版本。

当前依赖：

```text
h5py==3.12.1
numpy==2.1.3
requests==2.32.3
xgboost==3.4.1
```

### 5.3 浏览器数据格式

- 清单：`lpw/data/manifest.json`
- 帧目录：`lpw/data/frames/`
- 档案长度：最近 72 个小时。
- 单帧：gzip 压缩的 little-endian `int16`。
- 数组顺序：layer-major，依次为 Low、Middle、High。
- 当前显示网格：181 × 360。
- 比例：`0.01 mm`。
- 缺测值：`-32768`。
- 文件名：`YYYYMMDDTHHMMSSZ.bin.gz`。

### 5.4 网络健壮性

- MIMIC 请求使用重试机制，覆盖 `429/500/502/503/504`。
- 根目录和月份目录超时为 30 秒，NetCDF 下载超时为 120 秒。
- 页面数据读取也会重试。
- 时间序列以 4 个并发 worker 加载 72 帧；单个帧失败时保留空缺，不让整张时间序列失败。

## 6. 前端当前实现

### 6.1 主要文件

- `lpw/index.html`：页面结构和英文文案。
- `lpw/assets/lpw.css`：Dark/Light 双主题、响应式布局和组件样式。
- `lpw/assets/lpw.js`：数据加载、地图、三维图、播放和时间序列。
- `lpw/assets/gnss.js`：历史 GNSS 数据解码、日期选择、平铺/三维散点和单站时间序列。
- `lpw/assets/coastlines.json`：本地海岸线。
- `lpw/assets/hero-earth-satellite.png`：顶部真实地球和卫星背景。
- `lpw/assets/team-logo.png`：INSIGHT Team 标志。
- `lpw/assets/wuhan-university-logo.png`：武汉大学校徽。

### 6.2 品牌与文案

- 左上品牌：`PSHX / LPW`，为普通 `div`，点击不会跳转主页。
- 顶部靠左有 `MIMIC LPW` 和 `GNSS LPW` 两个锚点菜单，点击后平滑滚动到相应地图模块；固定顶部栏通过 `scroll-margin-top` 避让。
- 顶部右侧有 Dark/Light 开关；主题选择写入 `localStorage`，刷新和重新打开页面后保持。
- 主标题：`Layered precipitable water from surface to sky`，无结尾标点。
- 团队名：`INSIGHT Team`。
- 学校组件：`Wuhan University` / `School of Geodesy and Geomatics`。
- 顶部四个组件顺序：
  - 左上：Wuhan University。
  - 右上：Research group。
  - 左下：Analysis time。
  - 右下：Selected point。
- 四个组件使用随主题变化的半透明背景。
- Analysis time 同时显示 UTC 和 Beijing `(UTC+8)`；北京时间为蓝绿色、小号、正常字重并尽量不换行。
- 浅色主题中的团队 Logo 和武大校徽为透明底深色图形；暗色主题中为透明底白色图形。
- 页面顶部仍使用真实地球与卫星背景，Light 主题通过浅色渐变覆盖保证深色文字可读。

当前前端缓存版本（2026-11-01）：

- `assets/lpw.css?v=20261101-6`
- `assets/lpw.js?v=20261101-2`
- `assets/gnss.js?v=20261101-9`

### 6.3 MIMIC 平铺视图

- 使用原生 Canvas 直接绘制三个全球 LPW 栅格。
- 不使用在线底图，不实现缩放和平移。
- 叠加本地海岸线。
- 地图内部不显示经纬网文字。
- 色标固定为 0–40+ mm，并位于地图模块底部。
- 点击任意层地图选择最近网格点，并在下方加载 72 小时时间序列。
- 当前播放间隔：`80 ms`，约 12.5 帧/秒。

### 6.4 三维叠放视图

- MIMIC 使用 Plotly 三个 `surface` 图层。
- MIMIC Low/Middle/High 的高度间隔由 `layerGap = 8` 控制，三维场景纵向比例为 `1.12`。
- GNSS 三维叠放使用 `gap = 12`、纵向比例 `1.22`，每层绘制覆盖经度 -180–180°、纬度 -90–90° 的矩形边界框；暗色主题为白色，浅色主题为深色。
- GNSS 三维平面保持透明，只绘制海岸线、矩形边界和站点散点，不填充陆地。
- 三维图支持 Plotly 自带旋转、缩放。
- MIMIC 三维表面悬停记录经纬度，点击后加载相同的 72 小时时间序列；GNSS 点击站点后加载该站完整可用历史。

### 6.5 MIMIC 点位时间序列

- 三条线分别代表 Low、Middle、High。
- 悬浮标签只显示数值和 `mm`，不显示日期时间，也不在数值旁重复显示 Low/Middle/High。
- 日期时间通过横坐标读取。
- 图例仍保留层名，便于识别三条线。

### 6.6 历史 GNSS LPW 查询模块

- 模块位于页面底部、MIMIC 三日时间序列之后。
- 原始数据：`H:\LPW模型\GNSSLPW.mat`。
- 原数据时间范围：2015-01-01 至 2025-12-08；`TIME2` 未设置时区，因此页面明确标注为 dataset time，不擅自解释为 UTC。
- 原始观测 803,855 条；去除 56 组数值完全一致的重复时刻—站点记录后，发布 803,799 条。
- 包含 20,721 个时刻和 211 个站点元数据，历史观测实际覆盖 186 个站。
- 浏览器数据位于 `lpw/data/gnss/`：
  - `manifest.json`：时刻、时刻偏移和站点名称/编号/经纬度。
  - `observations.bin.gz`：约 4.06 MB 的稀疏压缩观测。
- 二进制按 `time_index (uint16)`、`station_index (uint8)`、Low/Middle/High (`int16`) 分数组保存；比例为 0.01 mm。
- `lpw/pipeline/export_gnss_history.m` 可从原 MAT 文件重新生成数据。
- `lpw/pipeline/test_gnss_export.py` 验证压缩文件长度、索引范围、时刻偏移和记录计数。
- 页面脚本：`lpw/assets/gnss.js`。
- 页面默认选择 `2023-05-20 00:00`；当天还可选择 `06:00`、`12:00`、`18:00`。如果数据中不存在默认日期，则自动回退到最新可用时刻。
- 日期控件选择日期，时刻下拉框列出该日实际存在的全部观测时间；前后按钮逐观测时刻移动。
- GNSS 平铺视图与 MIMIC 使用相同的三卡片模板（层编号、层名和气压范围），每张卡片保留独立站点点击查询。
- 平铺视图使用三个 Plotly 全球散点地图和海岸线；站点 marker size 为 `9`。
- 三维视图使用三个分层 `scatter3d` 站点层，并在各层叠加海岸线和全球矩形边界；站点 marker size 为 `6`。
- 平铺与三维视图均关闭 Plotly 内置右侧竖向 colorbar，共用模块底部的横向 `0–40+ mm` 色标，样式与 MIMIC 一致。
- 某时刻没有数据的站点不绘制、不补值，也不会导致页面报错。
- 点击平铺或三维站点后，下方只使用该站真实存在的时刻绘制完整 Low/Middle/High 折线；不再把该站铺到全部全局时刻后插入大量 `null`，因此零散缺站不会把折线切碎。
- GNSS 平铺、三维悬浮标签只显示站名和 LPW 数值；单站历史标题显示站名与经纬度，不显示内部 `Station xx` 编号。
- MIMIC 地图与其时间序列、GNSS 地图与其时间序列之间的垂直留白均已压缩。

## 7. GitHub Actions

### 7.1 LPW 工作流

文件：`.github/workflows/update-lpw.yml`

- 名称：`Update real-time LPW`。
- `actions/checkout@v5` 和 `actions/setup-python@v6`，避免旧 Node.js 20 Action 警告。
- 运行环境：Ubuntu + Python 3.12。
- 超时：180 分钟。
- 权限：`contents: write`、`pages: write`。
- 并发组：`update-lpw`，`cancel-in-progress: false`。
- 完整更新命令：`python update_data.py --hours 72 --max-new 8`。
- 成功后由 `github-actions[bot]` 提交 `lpw/data`，随后请求 Pages 重建。

### 7.2 当前定时可靠性方案

GitHub 官方说明 `schedule` 可能延迟，负载高时甚至丢弃排队任务。项目曾在一天内只于约 03:34、08:00、13:47 自动成功，分别一次补入 5、4、6 个小时的数据。

当前补偿方案：

```yaml
schedule:
  - cron: "13,43 * * * *"
```

- 每小时第 13 和 43 分钟各尝试一次，避开整点高负载。
- 工作流首先拉取默认分支最新内容。
- 若 `manifest.updated_at` 距当前不足 45 分钟，备用运行快速跳过所有安装、测试和模型计算。
- 若第一个触发被丢弃或失败，第二个触发可补跑。
- `workflow_dispatch` 手动触发始终执行完整更新，不受 45 分钟门限影响。
- 这能提高可靠性，但 GitHub cron 仍不提供严格 SLA。若未来必须保证每小时执行，应增加外部调度服务通过 GitHub API 触发 `workflow_dispatch`。

### 7.3 另一个独立工作流

`.github/workflows/download_TPW_gif.yml` 是旧的 TPW PNG/GIF 下载任务，与 LPW 模型更新是两套独立流程。修改 LPW 时不要误删或混用。

### 7.4 Cloudflare 外部每小时调度器

- 调度器源码：`automation/lpw-scheduler/`。
- Cloudflare Cron Trigger：每小时第 7 分钟（UTC）执行一次，即 `7 * * * *`。
- Worker 调用现有 `update-lpw.yml` 的 `workflow_dispatch` API，并发送 `force: false`。
- GitHub 原有第 13/43 分钟的 `schedule` 保留为兜底；45 分钟新鲜度门限会阻止重复模型计算。
- GitHub 网页手动点击 **Run workflow** 时，`force` 默认值为 `true`，仍可无条件执行完整更新。
- GitHub Fine-grained PAT 必须仅授权本仓库，并只授予 `Actions: Read and write`；令牌通过 Cloudflare `GITHUB_TOKEN` Secret 保存，禁止写入仓库。
- 新会话不能假定 Worker 已部署。应检查 Cloudflare Worker、Cron Trigger 和 Secret 状态；首次部署步骤见 `automation/lpw-scheduler/README.md`。

## 8. 部署流程

1. 在本地仓库修改并验证。
2. 用户通常通过 GitHub Desktop 提交并推送到 `main`。
3. GitHub Pages 使用自定义域名，`CNAME` 文件必须保留。
4. `_config.yml` 排除了 `lpw/pipeline`，因此计算代码和模型不是页面运行时资源；Actions 仍可在仓库检出后使用它们。
5. `lpw/data` 必须纳入发布内容，否则静态页面无法读取 LPW 数据。
6. 每次前端资源更新后检查浏览器缓存版本参数。

本地预览：

```text
python -m http.server 8768 --bind 127.0.0.1
```

然后访问：`http://127.0.0.1:8768/lpw/`。

## 9. 验证命令

### 9.1 前端

```text
node --check lpw/assets/lpw.js
node --check lpw/assets/gnss.js
git diff --check
```

浏览器人工检查：

- 页面无控制台错误。
- 三张平铺图、海岸线和 0–40 mm 色标正常。
- Play/Pause、前后帧和时间滑块正常。
- 点击平铺图能显示所选点和三条时间序列。
- 时间序列悬浮标签没有日期时间和层名重复框。
- 切换 3D 后三层间隔明显，点击后也能显示时间序列。
- Analysis time 的 UTC 与北京时间相差 8 小时。
- 手机和桌面宽度下卡片不溢出。
- Dark/Light 开关能同步更新网页、Canvas 海岸线和 Plotly 图表；刷新后主题保持。
- 顶部 `MIMIC LPW`、`GNSS LPW` 菜单能滚动到正确模块。

### 9.2 模型

在 `lpw/pipeline`：

```text
python -m pip install -r requirements.txt
python -m unittest -v test_lpw_model.py
```

必要时本地更新数据：

```text
python update_data.py --hours 72 --max-new 2
```

注意：此命令会修改 `lpw/data`，运行前先确认用户是否希望更新本地档案。

GNSS 数据导出后验证：

```text
python -m unittest -v test_gnss_export.py
```

GNSS 浏览器人工检查：

- 默认显示 `2023-05-20 00:00`；若该日期缺失则回退到最新可用时刻。
- 修改日期后，时刻下拉框只出现该日的有效时刻。
- 站点计数随时刻改变；缺站时仍正常绘制。
- Flat maps 和 3D stack 均能显示放大的三层站点散点，且仅使用模块底部的横向 0–40+ mm 共享色标。
- 3D stack 保持透明平面，无陆地填色；三层海岸线和矩形边界清晰。
- 点击任一站点后显示站名、坐标和三层完整历史折线，不显示内部测站号。

### 9.3 Workflow

- 验证 YAML 可解析。
- 检查 `schedule` 是否仍位于默认分支。
- 检查 Actions 是否处于启用状态。
- 区分“工作流触发时间”“开始执行时间”“完成/提交时间”；并发排队和 GitHub 延迟会使它们不同。
- 查看失败日志时重点检查：MIMIC 502、下载超时、模型测试、超时、`git pull --rebase` 冲突和 push 权限。

## 10. 已知限制与风险

1. GitHub `schedule` 不能绝对保证准点或不丢任务；当前双时段方案只是提高成功率。
2. MIMIC 服务器偶尔返回 502；前后端均有重试，但连续故障仍会失败。
3. 72 帧点选历史需要下载大量小文件，首次加载取决于网络和 GitHub Pages CDN。
4. 平铺图刻意不提供底图、缩放和平移，以保持稳定的栅格对齐。
5. 模型和系数在公开仓库中可被下载。
6. 模型转换尚未脚本化，是未来最值得补齐的可重复性环节。
7. 模型指纹变化后的首次 72 小时重算可能接近或超过普通小时任务耗时。
8. 浏览器需要支持 `DecompressionStream`；页面已对旧浏览器给出错误提示。
9. GNSS 原始 `TIME2` 没有时区元数据；除非获得用户确认，不应改标为 UTC 或北京时间。
10. GNSS 历史数据约 4.9 MB（清单加压缩观测），首次访问需额外下载；之后可由浏览器缓存。

## 11. 修改原则

- 保持平台英文界面，不随意更改品牌、层定义和科学术语。
- 不恢复在线底图或平移缩放，除非用户明确重新提出。
- 不改变模型输入/输出顺序。
- 不对 0.25° 系数、1°发布网格和经纬度行列方向做未经验证的转置。
- 不把 GPU-only 模型放入 Ubuntu CPU Actions。
- 不把三个图层分别归一化；共用固定 0–40 mm 色标才能跨层、跨时次比较。
- 不因为某个历史帧失败而让整条时间序列报错。
- 不在未确认的情况下提交或推送。

## 12. 建议的新会话开场提示

可直接向新会话发送：

> 请先完整阅读仓库根目录的 `LPW_PROJECT_HANDOFF.md` 和 `lpw/pipeline/README.md`，再检查 `git status`。本次只修改我接下来指定的内容，保留现有模型、数据格式、品牌、层定义和 Actions 补偿策略。修改后执行报告中的相应验证，并更新交接报告；不要自动提交或推送。

## 13. 修改记录

- 2026-10-29：建立本交接报告。
- 2026-10-29：当前平铺播放速度为 80 ms/帧；时间序列悬浮只显示数值和单位。
- 2026-10-29：LPW Action 改为每小时第 13/43 分钟双触发，并增加 45 分钟新鲜度门限。
- 2026-10-31：加入历史 GNSS LPW 查询模块、MATLAB 可重复导出脚本、稀疏压缩数据和导出测试。
- 2026-11-01：修复 GNSS 单站历史折线被全局缺测时刻大量切断的问题，改为按该站实际观测时刻连续绘制。
- 2026-11-01：GNSS 平铺图改为与 MIMIC 一致的三卡片模板；GNSS 三维图加入每层白色全球边界框，并增大 GNSS 与 MIMIC 三维层距。
- 2026-11-01：加入顶部 Dark/Light 主题开关并持久化用户选择；浅色主题同步重绘网页、Plotly 图表、海岸线和三维边界。GNSS 标签与历史标题不再显示内部测站号。
- 2026-11-01：顶部加入 MIMIC LPW/GNSS LPW 平滑定位菜单并压缩地图与对应历史图之间的留白；浅色主题使用透明底深色 Logo，暗色主题使用透明底白色 Logo；GNSS 三维保持透明平面、海岸线和矩形边界，不填充陆地。
- 2026-11-01：GNSS 默认显示 2023-05-20 00:00；平铺测站散点大小增至 9，三维测站散点大小增至 6。
- 2026-11-01：GNSS 平铺与三维视图移除 Plotly 右侧竖向 colorbar，统一使用模块底部的 0–40+ mm 横向共享色标，与 MIMIC 样式一致。
- 2026-11-05：加入 Cloudflare Workers 外部小时调度器；每小时第 7 分钟调用 `workflow_dispatch`，GitHub 第 13/43 分钟定时任务继续兜底，并为手动触发加入 `force` 输入以区分强制更新和外部常规更新。


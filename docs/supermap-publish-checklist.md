# SuperMap 服务发布清单

## 目标

把当前前端从“示范数据演示”推进到“真实 SuperMap WebGIS 服务演示”。发布完成后，前端只需要更新 `src/config/supermap.ts` 中的服务地址。

## 一、iDesktopX 数据工程

1. 新建工作空间，建议命名为 `wuhan-marathon.smwu`。
2. 导入 DEM：
   - 文件：`E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif`
   - 坐标系：WGS 84 / EPSG:4326
   - 范围：113.9999E-115.0001E, 29.9999N-31.0001N
   - 高程：-135m 至 771m
3. 导入当前工程已准备的矢量数据：
   - 候选马拉松路线线数据：`public/data/wuhan-marathon-routes.geojson`。
   - 补给点、医疗点、停车点、起终点：`public/data/wuhan-marathon-support-points.geojson`。
   - 后续可补充道路等级、道路宽度、路口转弯点、河湖、绿地、行政边界、兴趣点。
4. 生成赛事指标字段：
   - 路线长度。
   - 累计爬升。
   - 平均坡度、最大坡度、长坡比例。
   - 急转弯比例、窄路比例。
   - 补给覆盖率、医疗点平均间距。
   - 停车保障评分、遮阴覆盖率。
5. 制作二维地图：
   - 底图层：行政区、道路、水系、绿地。
   - 赛事层：候选路线、起终点、补给点、医疗点、停车点。
   - 样式：路线使用与前端一致的蓝、绿、红候选色。
6. 制作三维地形或场景：
   - DEM 作为地形底座。
   - 候选路线贴地显示。
   - 重点坡段可使用醒目颜色或标签。

## 二、iServer 发布服务

1. 确认 SuperMap License Center 中云许可稳定可用。当前日志已显示云许可激活且许可检查通过。
2. 启动 iServer：`http://127.0.0.1:8090/iserver`。
3. 登录 iServer 管理页面。
4. 发布二维地图服务，建议服务名：
   - `map-wuhan-marathon`
   - 预期 REST 地址：`http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道`
5. 发布三维场景服务，建议服务名：
   - `3D-wuhan-marathon`
   - 预期 REST 地址：`http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace`
6. 如果需要后端空间分析，再发布数据服务或处理自动化服务：
   - 路线坡度提取。
   - 补给覆盖分析。
   - 医疗点服务半径分析。
   - 多目标评分结果输出。

## 三、前端接入点

修改：

```text
src/config/supermap.ts
```

重点字段：

```text
expectedMapServiceUrl
expectedSceneServiceUrl
iServerBaseUrl
```

当前界面会自动检查：

```text
SuperMap iServer 是否连通
二维地图服务是否发布
三维地形服务是否发布
DEM 元数据是否已登记
GIS 数据包是否可下载
```

## 四、验收标准

1. 页面右侧 `SuperMap 接入` 中 iServer 显示 `已连接`。
2. 二维地图服务显示 `已发布`。
3. 三维地形服务显示 `已发布`。
4. 赛道对比、推荐方案、报告导出功能正常。
5. 作品文档说明已使用 SuperMap iDesktopX 处理数据，并使用 SuperMap iServer 发布服务。

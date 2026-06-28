# SuperMap iDesktopX → iServer 服务发布操作指南

> **预计耗时:** 15-20 分钟 · **前置条件:** iDesktopX 已安装，iServer 已启动

## 一、启动 iDesktopX

1. 打开 `E:\SuperMap\软件\`
2. 双击 `SuperMap iDesktopX.exe` 启动（或运行 `startup.bat`）
3. 首次启动可能需要 30-60 秒加载

## 二、新建工作空间

1. 菜单 → **文件** → **新建工作空间**
2. 保存到：`E:\SuperMap\超图\Supermap_marathon_web\data\wuhan-marathon.smwu`
3. 工作空间名称：`武汉马拉松赛道选型`

## 三、导入 DEM 数据

1. 右键 **数据源** → **新建数据源** → 存为 `E:\SuperMap\超图\Supermap_marathon_web\data\wuhan-dem.udbx`
2. 右键数据源 → **导入数据** → **导入栅格**
3. 选择文件：`E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif`
4. 确认坐标系为 **WGS 1984 (EPSG:4326)**
5. 导入后数据集名称改为 `wuhan_dem_30m`

## 四、导入矢量数据（GeoJSON）

### 4.1 导入候选赛道

1. 右键 wuhan-dem 数据源 → **导入数据** → **导入矢量**
2. 选择文件：`E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-routes.geojson`
3. 目标数据集名：`marathon_routes`
4. 坐标系：EPSG:4326

### 4.2 导入赛事保障点

1. 同上步骤，选择文件：`E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-support-points.geojson`
2. 目标数据集名：`marathon_support_points`
3. 坐标系：EPSG:4326

## 五、制作二维地图

1. 右键 **地图** → **新建地图** → 命名为 `武汉马拉松赛道地图`
2. 在图层管理器中添加图层：
   - **底图**: 从数据源拖入 DEM（可选，用于高程背景）
   - **路线图层**: 拖入 `marathon_routes`，按 `style_color` 字段设置线颜色，线宽 3px
   - **保障点图层**: 拖入 `marathon_support_points`，按类型设置图标
3. 设置地图全幅范围覆盖武汉市区（约 114.0-114.6E, 30.4-30.7N）
4. 保存地图

## 六、制作三维场景（可选但推荐）

1. 右键 **场景** → **新建场景** → 命名为 `武汉马拉松三维地形`
2. 添加 DEM 为地形图层
3. 添加 `marathon_routes` 为贴地矢量图层
4. 设置垂直拉伸系数 1.5-2.0 以突出地形起伏
5. 保存场景

## 七、发布到 iServer

### 7.1 确认 iServer 运行

- 浏览器打开 `http://127.0.0.1:8090/iserver/`
- 确认首页正常显示

### 7.2 发布二维地图服务

1. iDesktopX 中 → **在线** 菜单 → **发布服务** → **发布地图服务**
2. iServer 地址：`http://127.0.0.1:8090/iserver`
3. 选择要发布的地图：`武汉马拉松赛道地图`
4. 服务名称：`map-wuhan-marathon`
5. 服务接口：勾选 **REST**、**WMS**、**WMTS**
6. 点击 **发布**
7. 等待提示"发布成功"

### 7.3 发布三维场景服务（可选）

1. 同上 → **发布服务** → **发布三维服务**
2. 选择场景：`武汉马拉松三维地形`
3. 服务名称：`3D-wuhan-marathon`
4. 点击 **发布**

## 八、验证服务

发布成功后验证以下地址：

| 服务 | 验证地址 |
|------|---------|
| iServer 首页 | `http://127.0.0.1:8090/iserver/` |
| 二维地图 REST | `http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道` |
| 二维地图 WMS | `http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/wms111/武汉马拉松赛道` |
| 三维场景 | `http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace` |

## 九、更新前端配置

服务发布成功并验证后，编辑 `src/config/supermap.ts`：

```ts
// 将 WMS 改为指向自己的服务
wmsMapUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/wms111/武汉马拉松赛道",
wmsLayerName: "武汉马拉松赛道",
```

然后重新构建：
```powershell
npm run build
```

## 附：快速验证清单

- [ ] iDesktopX 启动成功
- [ ] 工作空间保存为 wuhan-marathon.smwu
- [ ] DEM 导入成功，坐标系正确
- [ ] GeoJSON 路线数据导入成功
- [ ] GeoJSON 保障点数据导入成功
- [ ] 二维地图制作完成，可预览
- [ ] 地图服务发布到 iServer 成功
- [ ] 浏览器验证 REST/WMS 地址返回正常
- [ ] 前端 SuperMap 状态面板显示"已发布"

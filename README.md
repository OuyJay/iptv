# 轻量化电视直播源网站

基于 GitHub Pages 的免费轻量级电视直播网站，支持全平台浏览器访问，自动检测设备系统切换适配协议。

## 特性

- **全平台支持**：兼容手机、平板、电脑等各种设备的浏览器（含旧版本）
- **自动协议适配**：根据设备自动选择最佳播放协议（HLS/DASH/FLV）
- **多源切换**：支持多个信号源，播放失败自动切换
- **分类展示**：频道按类别分组展示，方便查找
- **简洁界面**：简约大气的用户界面，适合各种设备屏幕尺寸
- **免费部署**：利用 GitHub Pages 免费部署，无需服务器
- **响应式设计**：自适应各种屏幕尺寸，优化移动端体验

## 技术栈

- **前端**：纯 HTML/CSS/JavaScript（无框架依赖，兼容老旧浏览器）
- **播放器**：Video.js（支持 HLS/DASH/FLV 多协议，含自动设备检测）
- **直播源管理**：JSON 格式存储直播源，支持跨平台调用

## 快速部署

### 通过 GitHub 部署

1. Fork 本仓库到你的 GitHub 账号
2. 进入仓库设置 (Settings)
3. 找到 "Pages" 选项
4. 将 Source 设置为 "main" 分支，点击保存
5. 等待几分钟后，你的网站将可通过 `https://[你的用户名].github.io/[仓库名]` 访问

### 本地测试

1. 克隆本仓库到本地
```bash
git clone https://github.com/[你的用户名]/[仓库名].git
cd [仓库名]
```

2. 使用任意 HTTP 服务器启动项目。例如，使用 Python：
```bash
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

3. 访问 `http://localhost:8000` 查看效果

## 自定义频道

编辑 `data/channels.json` 文件来自定义你的频道列表：

```json
{
  "categories": [
    {
      "id": "category_id",
      "name": "分类名称"
    }
  ],
  "channels": [
    {
      "name": "频道名称",
      "categoryId": "对应的分类ID",
      "logo": "频道Logo图片URL",
      "sources": [
        {
          "name": "信号源名称",
          "hls": "HLS格式直播源URL",
          "flv": "FLV格式直播源URL",
          "dash": "DASH格式直播源URL",
          "mp4": "MP4格式直播源URL"
        }
      ]
    }
  ]
}
```

### 频道配置说明

- **name**: 频道名称，显示在界面上
- **categoryId**: 对应分类的ID
- **logo**: 频道Logo的URL
- **sources**: 信号源数组，可以添加多个信号源
  - **name**: 信号源名称
  - **hls**: （可选）HLS格式直播源URL (.m3u8)
  - **flv**: （可选）FLV格式直播源URL (.flv)
  - **dash**: （可选）DASH格式直播源URL (.mpd)
  - **mp4**: （可选）MP4格式直播源URL (.mp4)

注意：每个信号源至少提供一种格式的URL。建议至少提供HLS格式，因为兼容性最好。

## 获取直播源

请确保你使用的直播源拥有合法的播放权利。以下是一些获取直播源的方法：

1. IPTV提供商的公开直播源
2. 各电视台官方网站提供的直播流
3. 开源的IPTV资源

## 自定义界面

- 修改 `css/style.css` 文件来自定义网站的样式
- 修改 `index.html` 文件来调整网站的结构

## 注意事项

- 请确保你有权使用你添加的直播源
- 部分直播源可能会定期更改URL，需要定期维护
- 一些国家/地区对直播内容有限制，请遵守当地法律法规

## License

MIT 
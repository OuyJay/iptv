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

## 本地运行指南

### 方法一：使用 Python（推荐）

1. 确保安装了 Python 3
2. 在项目根目录运行命令：
```bash
# Python 3
python3 -m http.server

# 如果你的系统默认是 Python 3，也可以使用：
python -m http.server
```
3. 在浏览器中访问: `http://localhost:8000`

### 方法二：使用 Node.js

1. 确保安装了 Node.js
2. 全局安装 http-server:
```bash
npm install -g http-server
```
3. 在项目根目录运行:
```bash
http-server -p 8000
```
4. 在浏览器中访问: `http://localhost:8000`

### 方法三：使用 PHP（适用于 macOS 用户）

macOS 自带 PHP，可以直接运行:
```bash
php -S localhost:8000
```

## 部署到 GitHub Pages

1. Fork 本仓库到你的 GitHub 账号
2. 进入仓库设置 (Settings)
3. 找到 "Pages" 选项
4. 将 Source 设置为 "main" 分支，点击保存
5. 等待几分钟后，你的网站将可通过 `https://[你的用户名].github.io/[仓库名]` 访问

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

## 常见问题解决

### 网站无法加载

1. **检查服务是否正常运行**
   - 确保本地服务器命令执行成功且没有报错
   - 确认访问的URL正确（http://localhost:8000）

2. **控制台错误检查**
   - 在浏览器中按F12打开开发者工具
   - 查看Console标签中是否有错误信息
   - 如有关于跨域(CORS)的错误，可能是直播源不允许跨域访问

3. **资源加载问题**
   - 检查网络连接是否正常
   - 确认channels.json文件格式正确且没有语法错误

### 视频无法播放

1. **检查直播源有效性**
   - 确认channels.json中的URL是否可访问
   - 尝试在VLC等播放器中直接打开直播源URL测试

2. **协议兼容性问题**
   - 不同设备支持的协议不同，确保提供多种格式的直播源
   - iOS设备优先使用HLS (.m3u8)格式
   - 旧版浏览器优先使用MP4格式

3. **网络限制问题**
   - 某些网络环境可能限制视频流量
   - 部分直播源可能限制了地理位置访问

## 自定义界面

- 修改 `css/style.css` 文件来自定义网站的样式
- 修改 `index.html` 文件来调整网站的结构
- 修改 `js/app.js` 文件来调整功能逻辑

## 注意事项

- 请确保你有权使用你添加的直播源
- 部分直播源可能会定期更改URL，需要定期维护
- 一些国家/地区对直播内容有限制，请遵守当地法律法规

## License

MIT 
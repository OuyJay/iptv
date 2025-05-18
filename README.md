# 简约电视直播网站

一个基于纯HTML、CSS和JavaScript的简约风格电视直播网站，可部署在GitHub Pages等静态网站托管平台上。

## 特点

- 简约且美观的用户界面
- 响应式设计，适配各种设备屏幕
- 支持多种播放协议（HLS、DASH、FLV）
- 自动检测设备和浏览器，选择最优播放协议
- 频道分类浏览
- 多种错误处理和重试机制
- 无需后端服务器，纯静态部署

## 使用方法

1. 下载或克隆此仓库到本地
2. 修改 `data/channels.json` 文件，添加您自己的频道和直播源
3. 使用任意HTTP服务器在本地预览（如：`python3 -m http.server 8000`）
4. 部署到GitHub Pages或其他静态网站托管平台

## 自定义频道

在 `data/channels.json` 文件中，您可以按以下格式添加频道：

```json
{
  "categories": [
    {
      "name": "分类名称",
      "channels": [
        {
          "name": "频道名称",
          "sources": [
            {
              "type": "hls",
              "url": "直播源URL.m3u8"
            },
            {
              "type": "flv",
              "url": "直播源URL.flv"
            }
          ],
          "logo": "频道Logo图片URL"
        }
      ]
    }
  ]
}
```

每个频道可以有多个不同协议的直播源，系统会根据设备自动选择最适合的协议。

## 支持的协议

- HLS (.m3u8)
- DASH (.mpd)
- FLV (.flv)

## 本地开发

1. 进入项目目录
2. 启动本地HTTP服务器：
   - Python 3: `python3 -m http.server 8000`
   - Python 2: `python -m SimpleHTTPServer 8000`
   - Node.js: `npx serve`
3. 在浏览器中访问 `http://localhost:8000`

## 注意事项

- 直播源必须支持CORS（跨域资源共享），否则可能无法播放
- 部分浏览器可能限制自动播放，需要用户交互后才能开始播放
- 添加直播源时请确保链接可用且为实际直播流格式 
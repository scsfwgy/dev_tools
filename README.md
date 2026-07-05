# DevTools

开发工具集。

## 项目结构

```
DevTools/
├── api/                # Vercel serverless 入口
│   └── index.py
├── backend/            # Flask 后端
│   ├── app.py          # 应用入口
│   ├── routes/         # 路由蓝图
│   ├── service/        # 业务逻辑
│   └── config/         # 配置文件
├── frontend/           # 前端静态资源
│   ├── index.html      # 默认主页
│   ├── css/
│   ├── js/
│   ├── locales/        # 国际化
│   └── images/
├── scripts/            # 工具脚本
├── config/             # 项目配置
├── doc/                # 文档
├── logs/               # 日志目录
├── start.sh            # 启动脚本
├── requirements.txt    # Python 依赖
└── vercel.json         # Vercel 部署配置
```

## 快速开始

```bash
# 安装依赖并启动
./start.sh start

# 调试模式（前台运行）
./start.sh debug

# 停止服务
./start.sh stop

# 查看状态
./start.sh status
```

启动后访问：`http://127.0.0.1:8730`

## 技术栈

- **后端**: Python Flask
- **前端**: 原生 HTML/CSS/JS
- **部署**: Vercel (serverless)

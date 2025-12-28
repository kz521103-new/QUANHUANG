<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# iFlow CLI - 双人触摸屏格斗游戏项目指南

## 📋 项目概述

这是一个使用HTML5 Canvas和原生JavaScript开发的双人触摸屏格斗游戏，类似拳皇风格，专为触摸屏设备优化，支持两个玩家在同一台电脑上进行对战。

### 技术栈
- **前端渲染**: HTML5 Canvas
- **游戏引擎**: 原生JavaScript
- **样式系统**: CSS3
- **服务器**: Python HTTP服务器 (内置)
- **控制方式**: 触摸屏 + 键盘支持

## 🚀 项目运行

### 快速启动
```bash
# Windows用户
双击 启动游戏.bat

# 手动启动
python -m http.server 8080
# 然后在浏览器访问 http://localhost:8080
```

### 浏览器要求
- 推荐使用现代浏览器：Chrome、Firefox、Edge
- 需要支持HTML5 Canvas和触摸事件

## 🎮 游戏操作

### 触摸屏操作（推荐）
**玩家1（屏幕左侧）：**
- 方向控制：移动和跳跃
- 拳：基础攻击（伤害10点）
- 脚：强力攻击（伤害15点）
- 防：防御（减少50%伤害）

**玩家2（屏幕右侧）：**
- 方向控制：移动和跳跃
- 拳：基础攻击（伤害10点）
- 脚：强力攻击（伤害15点）
- 防：防御（减少50%伤害）

### 键盘操作（测试用）
**玩家1：** A/D移动，W跳跃，1拳攻击，2脚攻击，3防御
**玩家2：** ←/→移动，↑跳跃，小键盘1拳攻击，小键盘2脚攻击，小键盘3防御

## 📁 项目文件结构

### 核心文件
- **index.html**: 主游戏界面，包含Canvas画布、UI元素和触摸屏控制
- **game.js**: 游戏主类，负责游戏循环、渲染、背景系统和音效
- **player.js**: 玩家类，处理角色逻辑、状态管理和战斗系统
- **controls.js**: 控制系统，处理触摸屏和键盘输入事件
- **style.css**: 游戏样式和触摸屏控制布局

### 启动文件
- **启动游戏.bat**: Windows批处理启动脚本
- **游戏说明.md**: 详细的游戏说明和操作指南

## 🔧 技术特性

### 游戏引擎
- **60FPS游戏循环**: 使用requestAnimationFrame实现流畅游戏体验
- **Canvas渲染**: 高性能的2D图形渲染
- **碰撞检测**: 精确的攻击命中和玩家重叠检测
- **状态管理**: 完整的角色状态系统（空闲、移动、跳跃、攻击、防御、受击）

### 视觉效果
- **背景系统**: 动态云朵和渐变天空
- **角色渲染**: 支持面向方向、状态变化的角色绘制
- **特效系统**: 攻击特效、受击效果、粒子效果
- **UI界面**: 生命值条、游戏结果显示

### 输入系统
- **触摸屏优化**: 支持多点触控和按钮反馈
- **键盘备用**: 完整的键盘控制支持
- **事件处理**: 防误触和流畅的输入响应

### 音效系统
- **基础音效**: 使用Web Audio API生成简单音效
- **音效类型**: 攻击音效、受击音效、跳跃音效

## 🎯 开发规范

### 代码结构
- **类设计**: 使用ES6 Class进行面向对象编程
- **模块化**: 按功能分离到不同JavaScript文件
- **命名规范**: 使用驼峰命名法，语义化命名

### 样式规范
- **CSS**: 使用Flexbox布局和CSS3特性
- **响应式**: 支持不同屏幕尺寸的自适应
- **视觉效果**: 使用渐变、阴影和过渡效果

### 性能优化
- **动画优化**: 使用requestAnimationFrame确保60FPS
- **内存管理**: 及时清理特效和事件监听器
- **渲染优化**: 只在必要时重绘Canvas内容

## 🐛 故障排除

### 常见问题
1. **游戏无法加载**: 确保使用现代浏览器
2. **触摸屏无响应**: 检查浏览器触摸事件权限
3. **性能问题**: 关闭其他资源占用程序
4. **音频无声音**: 检查浏览器音频权限

### 调试信息
- 游戏在本地服务器时会显示调试面板
- 包含玩家生命值和FPS信息
- 控制台输出初始化和错误信息

## 📱 兼容性

### 设备支持
- **触摸屏设备**: 最佳游戏体验
- **桌面电脑**: 支持鼠标和键盘操作
- **平板电脑**: 完美支持触摸屏控制

### 浏览器兼容性
- Chrome 60+: 完全支持
- Firefox 55+: 完全支持
- Edge 79+: 完全支持
- Safari 12+: 部分支持（触摸优化可能需要调整）

## 🎮 游戏机制

### 战斗系统
- **生命值**: 每个玩家初始100点生命值
- **攻击类型**: 拳攻击（10点伤害）+ 脚攻击（15点伤害）
- **防御机制**: 减少50%受到的伤害
- **空中战斗**: 支持跳跃中的攻击和防御

### 视觉效果
- **角色状态**: 不同状态下的颜色变化
- **攻击特效**: 攻击时的视觉反馈
- **受击效果**: 被攻击时的特效显示
- **背景动画**: 动态云朵和地面装饰

## 🔄 开发建议

### 扩展功能
- 可添加更多角色和招式
- 可实现连击系统
- 可添加游戏关卡和AI对手
- 可集成更丰富的音效和背景音乐

### 性能优化
- 可使用精灵图优化角色渲染
- 可实现对象池管理特效
- 可添加渲染分层系统

### 移动端优化
- 可添加触摸手势支持
- 可优化按钮大小和布局
- 可添加设备方向检测

---

**注意**: 这是一个完整的游戏原型，展示了HTML5游戏开发的核心概念和最佳实践。项目结构清晰，代码注释完整，适合学习和进一步开发。
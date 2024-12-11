import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// 配置 CORS
app.use(cors({
  origin: 'http://localhost:5173', // Vite 开发服务器的默认地址
  credentials: true
}))
app.use(express.json())

const SCENES_PATH = path.join(__dirname, 'src/data/scenes.json')
const DATA_PATH = path.join(__dirname, 'src/data/data.json')
const PRESETS_PATH = path.join(__dirname, 'src/data/presets.json')

// 确保文件存在
const ensureFile = async (filePath, defaultContent) => {
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultContent))
  }
}

// 初始化文件
await ensureFile(SCENES_PATH, { scenes: [] })
await ensureFile(DATA_PATH, {})
await ensureFile(PRESETS_PATH, {})

// 获取场景列表
app.get('/api/scenes', async (req, res) => {
  try {
    console.log('读取场景列表') // 调试日志
    const data = await fs.readFile(SCENES_PATH, 'utf8')
    const scenes = JSON.parse(data)
    console.log('当前场景列表:', scenes) // 调试日志
    res.json(scenes)
  } catch (error) {
    console.error('读取场景列表失败:', error)
    res.status(500).json({ error: '读取场景列表失败' })
  }
})

// 保存场景列表
app.post('/api/scenes', async (req, res) => {
  try {
    console.log('保存场景列表:', req.body) // 调试日志
    await fs.writeFile(SCENES_PATH, JSON.stringify(req.body, null, 2))
    console.log('场景列表保存成功') // 调试日志
    res.json({ success: true })
  } catch (error) {
    console.error('保存场景列表失败:', error)
    res.status(500).json({ error: '保存场景列表失败' })
  }
})

// 获取场景数据
app.get('/api/data', async (req, res) => {
  try {
    console.log('读取场景数据') // 调试日志
    const data = await fs.readFile(DATA_PATH, 'utf8')
    res.json(JSON.parse(data))
  } catch (error) {
    console.error('读取场景数据失败:', error)
    res.status(500).json({ error: '读取场景数据失败' })
  }
})

// 保存场景数据
app.post('/api/save', async (req, res) => {
  try {
    console.log('保存场景数据:', req.body) // 调试日志
    const data = req.body
    // 确保数据格式正确
    if (typeof data === 'object') {
      await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2))
      console.log('场景数据保存成功') // 调试日志
      res.json({ success: true })
    } else {
      throw new Error('数据格式不正确')
    }
  } catch (error) {
    console.error('保存场景数据失败:', error)
    res.status(500).json({ error: '保存场景数据失败' })
  }
})

// 获取预设值
app.get('/api/presets', async (req, res) => {
  try {
    const data = await fs.readFile(PRESETS_PATH, 'utf8')
    res.json(JSON.parse(data))
  } catch (error) {
    console.error('读取预设值失败:', error)
    res.status(500).json({ error: '读取预设值失败' })
  }
})

// 保存预设值
app.post('/api/presets', async (req, res) => {
  try {
    await fs.writeFile(PRESETS_PATH, JSON.stringify(req.body, null, 2))
    res.json({ success: true })
  } catch (error) {
    console.error('保存预设值失败:', error)
    res.status(500).json({ error: '保存预设值失败' })
  }
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
}) 
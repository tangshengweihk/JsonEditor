import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

const configPath = path.join(__dirname, 'config.json')
let dataDir = ''  // 数据文件夹路径

// 读取配置文件
async function loadConfig() {
  try {
    const config = await fs.readFile(configPath, 'utf8')
    const { dataDir: savedDir } = JSON.parse(config)
    if (savedDir) {
      // 验证目录是否存在且包含必要文件
      const requiredFiles = ['data.json', 'presets.json', 'scenes.json']
      const missingFiles = []
      
      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(savedDir, file))
        } catch {
          missingFiles.push(file)
        }
      }

      if (missingFiles.length === 0) {
        dataDir = savedDir
        console.log('已加载数据目录:', dataDir)
      }
    }
  } catch (error) {
    console.log('未找到配置文件或配置无效')
  }
}

// 保存配置文件
async function saveConfig() {
  try {
    await fs.writeFile(configPath, JSON.stringify({ dataDir }, null, 2))
  } catch (error) {
    console.error('保存配置失败:', error)
  }
}

// 打开文件夹选择对话框
app.get('/api/select-folder', async (req, res) => {
  try {
    // 使用 PowerShell 打开文件夹选择对话框
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms;
       $dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
       $dialog.Description = '选择数据文件夹';
       $dialog.ShowNewFolderButton = $false;
       if($dialog.ShowDialog() -eq 'OK') {
         $dialog.SelectedPath
       }`
    ])

    let folderPath = ''
    ps.stdout.on('data', (data) => {
      folderPath += data.toString().trim()
    })

    ps.stderr.on('data', (data) => {
      console.error(data.toString())
    })

    ps.on('close', async (code) => {
      if (code !== 0 || !folderPath) {
        return res.status(400).json({ error: '未选择文件夹' })
      }

      try {
        // 检查并创建必要的文件
        const requiredFiles = {
          'data.json': {
            "场景1": {},
            "场景2": {},
            "场景3": {},
            "场景4": {}
          },
          'presets.json': {
            "场景1": {},
            "场景2": {},
            "场景3": {},
            "场景4": {}
          },
          'scenes.json': {
            "scenes": ["场景1", "场景2", "场景3", "场景4"]
          }
        }
        
        for (const [file, defaultContent] of Object.entries(requiredFiles)) {
          const filePath = path.join(folderPath, file)
          try {
            await fs.access(filePath)
          } catch {
            // 如果文件不存在，创建它
            await fs.writeFile(
              filePath, 
              JSON.stringify(defaultContent, null, 2),
              'utf8'
            )
          }
        }
        
        dataDir = folderPath
        await saveConfig()  // 保存配置
        res.json({ success: true, dir: dataDir })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取当前选择的目录
app.get('/api/current-dir', (req, res) => {
  res.json({ dir: dataDir })
})

// 获取场景列表
app.get('/api/scenes', async (req, res) => {
  try {
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    const data = await fs.readFile(path.join(dataDir, 'scenes.json'), 'utf8')
    const scenes = JSON.parse(data)
    res.json(scenes)
  } catch (error) {
    console.error('读取场景列表失败:', error)
    res.status(500).json({ error: '读取场景列表失败' })
  }
})

// 保存场景列表
app.post('/api/scenes', async (req, res) => {
  try {
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    await fs.writeFile(path.join(dataDir, 'scenes.json'), JSON.stringify(req.body, null, 2))
    res.json({ success: true })
  } catch (error) {
    console.error('保存场景列表失败:', error)
    res.status(500).json({ error: '保存场景列表失败' })
  }
})

// 获取场景数据
app.get('/api/data', async (req, res) => {
  try {
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    const filePath = path.join(dataDir, 'data.json')
    
    try {
      await fs.access(filePath)
    } catch {
      // 如果文件不存在，返回空对象
      return res.json({})
    }
    
    const data = await fs.readFile(filePath, 'utf8')
    const jsonData = JSON.parse(data)
    res.json(jsonData)
  } catch (error) {
    console.error('读取场景数据失败:', error)
    res.status(500).json({ error: '读取场景数据失败' })
  }
})

// 保存场景数据
app.post('/api/save', async (req, res) => {
  try {
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    const data = req.body
    // 确保数据格式正确
    if (typeof data === 'object') {
      await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(data, null, 2))
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
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    const filePath = path.join(dataDir, 'presets.json')
    
    try {
      await fs.access(filePath)
    } catch {
      // 如果文件不存在，返回空预设
      return res.json({
        "场景1": {},
        "场景2": {},
        "场景3": {},
        "场景4": {}
      })
    }
    
    const data = await fs.readFile(filePath, 'utf8')
    try {
      const presets = JSON.parse(data)
      res.json(presets)
    } catch (parseError) {
      console.error('JSON解析错误:', parseError)
      // 如果解析失败，返回空预设
      return res.json({
        "场景1": {},
        "场景2": {},
        "场景3": {},
        "场景4": {}
      })
    }
  } catch (error) {
    console.error('读取预设值失败:', error)
    res.status(500).json({ error: '读取预设值失败' })
  }
})

// 保存预设值
app.post('/api/presets', async (req, res) => {
  try {
    if (!dataDir) {
      return res.status(400).json({ error: '请先选择数据文件夹' })
    }
    await fs.writeFile(path.join(dataDir, 'presets.json'), JSON.stringify(req.body, null, 2))
    res.json({ success: true })
  } catch (error) {
    console.error('保存预设值失败:', error)
    res.status(500).json({ error: '保存预设值失败' })
  }
})

const PORT = 3000

// 启动服务器前先加载配置
loadConfig().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`)
    console.log(`数据目录: ${dataDir || '未设置'}`)
  })
})
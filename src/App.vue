<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const scenes = ref<string[]>([])
const activeScene = ref('')
const isSceneEditMode = ref(false)
const isDataEditMode = ref(false)
const originalScenes = ref<{ [key: string]: any }>({})
const sceneData = ref<Record<string, any>>({})

// 新增数据相关的响应式变量
const newDataKey = ref('')
const newDataValue = ref('')

// 添加预设值相关的状态
const presets = ref<Record<string, Record<string, string[]>>>({})

// 添加临时存储编辑数据的变量
const tempEditData = ref<Record<string, string>>({})

// 修改对 activeScene 的监听
watch(activeScene, (newScene, oldScene) => {
  if (isDataEditMode.value) {
    // 检查是否有未保存的更改
    const currentSceneData = sceneData.value[oldScene] || {}
    const hasUnsavedChanges = JSON.stringify(tempEditData.value) !== JSON.stringify(currentSceneData)
    
    if (hasUnsavedChanges) {
      const confirmSwitch = confirm('当前场景有未保存的更改，是否保存？')
      if (confirmSwitch) {
        // 保存当前场景的更改
        sceneData.value[oldScene] = { ...tempEditData.value }
        saveToFile()
      }
    }
    
    // 切换到新场景的数据
    const newSceneData = sceneData.value[newScene] || {}
    tempEditData.value = JSON.parse(JSON.stringify(newSceneData))
  }
})

// 修改进入编辑模式的逻辑
const enterDataEditMode = () => {
  isDataEditMode.value = true
  // 确保当前场景存在数据
  const currentSceneData = sceneData.value[activeScene.value] || {}
  // 深拷贝当前场景数据到临时存储
  tempEditData.value = JSON.parse(JSON.stringify(currentSceneData))
}

// 修改数据编辑的取消方法
const cancelDataEdit = () => {
  // 检查是否有未保存的更改
  const currentSceneData = sceneData.value[activeScene.value] || {}
  const hasUnsavedChanges = JSON.stringify(tempEditData.value) !== JSON.stringify(currentSceneData)
  
  if (hasUnsavedChanges) {
    const confirmCancel = confirm('有未保存的更改，确定要取消吗？')
    if (!confirmCancel) {
      return
    }
  }
  
  isDataEditMode.value = false
  // 清空临时数据
  tempEditData.value = {}
}

// 修改添加数据的方法
const addData = () => {
  if (newDataKey.value && newDataValue.value) {
    // 检查键名是否已存在
    if (tempEditData.value && tempEditData.value[newDataKey.value]) {
      alert('该键名已存在，请使用其他名称')
      return
    }
    
    // 确保 tempEditData 已初始化
    if (!tempEditData.value) {
      tempEditData.value = {}
    }
    tempEditData.value[newDataKey.value] = newDataValue.value

    // 暂存预设值，但不立即保存到服务器
    if (!presets.value[activeScene.value]) {
      presets.value[activeScene.value] = {}
    }
    if (!presets.value[activeScene.value][newDataKey.value]) {
      presets.value[activeScene.value][newDataKey.value] = []
    }
    if (!presets.value[activeScene.value][newDataKey.value].includes(newDataValue.value)) {
      presets.value[activeScene.value][newDataKey.value].unshift(newDataValue.value)
    }

    newDataKey.value = ''
    newDataValue.value = ''
  }
}

// 修改数据编辑的保存方法
const saveDataEdit = async () => {
  try {
    // 将临时数据保存到实际数据中
    sceneData.value[activeScene.value] = { ...tempEditData.value }
    await saveToFile()
    
    // 保存预设值
    await fetch('/api/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presets.value)
    })
    
    isDataEditMode.value = false
  } catch (error) {
    console.error('保存数据编辑失败:', error)
  }
}

// 修改删除数据的方法
const deleteDataAndPreset = async (key: string) => {
  // 删除临时数据中的键
  delete tempEditData.value[key]
  
  // 删除预设中的对应键
  if (presets.value[activeScene.value] && presets.value[activeScene.value][key]) {
    const newPresets = { ...presets.value }
    delete newPresets[activeScene.value][key]
    presets.value = newPresets

    // 保存更新后的预设到服务器
    await fetch('/api/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presets.value)
    }).catch(error => {
      console.error('保存预设值失败:', error)
    })
  }
}

// 修改场景名称处理方法
const handleSceneNameChange = async (oldName: string, newName: string) => {
  if (oldName === newName || !newName) return
  
  // 检查新场景名是否已存在
  if (scenes.value.includes(newName)) {
    alert('场景名称已存在，请使用其他名称')
    return
  }
  
  const index = scenes.value.indexOf(oldName)
  if (index !== -1) {
    scenes.value[index] = newName
    // 更新场景数据的键名
    const newData = { ...sceneData.value }
    newData[newName] = sceneData.value[oldName]
    delete newData[oldName]
    sceneData.value = newData
    
    if (activeScene.value === oldName) {
      activeScene.value = newName
    }
  }
}

// 修改保存方法
const saveToFile = async () => {
  try {
    const fullData: Record<string, any> = {}
    scenes.value.forEach(scene => {
      fullData[scene] = sceneData.value[scene] || {}
    })

    // 使用 Promise.all 同时处理两个请求
    await Promise.all([
      fetch('/api/scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenes: scenes.value })
      }).catch(error => {
        throw new Error('保存场景列表失败: ' + error.message)
      }),
      
      fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullData)
      }).catch(error => {
        throw new Error('保存场景数据失败: ' + error.message)
      })
    ])

    // 更新本地数据
    sceneData.value = fullData
  } catch (error) {
    console.error('保存失败:', error)
    throw error // 向上传递错误
  }
}

// 修改 watch 逻辑
watch([isSceneEditMode, isDataEditMode], async ([newSceneMode, newDataMode], [oldSceneMode, oldDataMode]) => {
  if (newSceneMode) {
    // 进入场景编辑模式时，只保存原始数据的副本，不保存到文件
    originalScenes.value = JSON.parse(JSON.stringify(sceneData.value))
  }
  
  if (!newSceneMode && oldSceneMode) {
    // 退出场景编辑模式时不做任何操作
    // 保存或取消的逻辑由按钮事件处理
    console.log('退出场景编辑模式')
  }
  
  if (!newDataMode && oldDataMode) {
    await saveToFile()
  }
})

// 修改确认删除场景的方法
const confirmDelete = async (scene: string) => {
  const index = scenes.value.indexOf(scene)
  if (index !== -1) {
    scenes.value.splice(index, 1)
    // 删除场景数据
    const newData = { ...sceneData.value }
    delete newData[scene]
    sceneData.value = newData
    
    // 删除预设数据
    const newPresets = { ...presets.value }
    delete newPresets[scene]
    presets.value = newPresets

    // 保存预设数据到服务器
    await fetch('/api/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presets.value)
    }).catch(error => {
      console.error('保存预设值失败:', error)
    })
    
    if (activeScene.value === scene) {
      activeScene.value = scenes.value[0] || ''
    }
  }
}

// 加载数据
const loadSceneData = async () => {
  try {
    // 先加载场景列表
    const scenesResponse = await fetch('/api/scenes').catch(() => null)
    if (!scenesResponse) {
      throw new Error('加载场景列表失败')
    }
    const scenesData = await scenesResponse.json()
    scenes.value = scenesData.scenes || []

    // 再加载场景数据
    const dataResponse = await fetch('/api/data').catch(() => null)
    if (!dataResponse) {
      throw new Error('加载场景数据失败')
    }
    const data = await dataResponse.json()
    
    // 确保每个场景都有对应的数据对象
    const fullData: Record<string, any> = {}
    scenes.value.forEach(scene => {
      fullData[scene] = data[scene] || {}
    })
    
    sceneData.value = fullData
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 添加默认场景方法
const addDefaultScene = () => {
  let newSceneName = `新场景${scenes.value.length + 1}`
  
  // 确保场景名称唯一
  let counter = scenes.value.length + 1
  while (scenes.value.includes(newSceneName)) {
    counter++
    newSceneName = `新场景${counter}`
  }
  
  scenes.value.push(newSceneName)
  sceneData.value[newSceneName] = {}
}

// 修改场景删除方法
const deleteScene = async (sceneName: string) => {
  if (confirm(`确定要删除场景 "${sceneName}" 吗？`)) {
    const index = scenes.value.indexOf(sceneName)
    if (index > -1) {
      scenes.value.splice(index, 1)
      delete sceneData.value[sceneName]
      if (activeScene.value === sceneName) {
        activeScene.value = scenes.value[0] || ''
      }
      await saveToFile()
    }
  }
}

// 添加 watch 来确保不会同时进入两种编辑模式
watch(isSceneEditMode, (newValue) => {
  if (newValue) {
    isDataEditMode.value = false
  }
})

watch(isDataEditMode, (newValue) => {
  if (newValue) {
    isSceneEditMode.value = false
  }
})

// 添加场景编辑的保存和取消方法
const saveSceneEdit = async () => {
  try {
    await saveToFile()
    isSceneEditMode.value = false
  } catch (error) {
    console.error('保存场景编辑失败:', error)
  }
}

// 修改取消场景编辑的方法
const cancelSceneEdit = async () => {
  try {
    // 恢复原始数据
    scenes.value = Object.keys(originalScenes.value)
    sceneData.value = JSON.parse(JSON.stringify(originalScenes.value))
    // 如果当前选中的场景已被删除，重新选择第一个场景
    if (!scenes.value.includes(activeScene.value)) {
      activeScene.value = scenes.value[0] || ''
    }
    isSceneEditMode.value = false
  } catch (error) {
    console.error('取消场景编辑失败:', error)
  }
}

// 修改加载预设值的方法
const loadPresets = async () => {
  try {
    const response = await fetch('/api/presets')
    const data = await response.json()
    // 直接使用获取到的数据，因为我们已经修改了数据结构为按场景存储
    presets.value = data || {}
  } catch (error) {
    console.error('加载预设值失败:', error)
    // 初始化为空对象
    presets.value = {}
  }
}

// 在组件挂载时加载预设值
onMounted(() => {
  loadSceneData()
  loadPresets()
})

const showPresetDialog = ref(false)
const currentEditKey = ref('')
const currentPresets = ref<string[]>([])
const newPreset = ref('')

// 编辑预设
const editPresets = (key: string) => {
  currentEditKey.value = key
  // 确保当前场景的预设值存在
  if (!presets.value[activeScene.value]) {
    presets.value[activeScene.value] = {}
  }
  // 确保当前键的预设值存在
  if (!presets.value[activeScene.value][key]) {
    presets.value[activeScene.value][key] = []
  }
  // 复制当前预设值
  currentPresets.value = [...(presets.value[activeScene.value][key])]
  showPresetDialog.value = true
}

// 添加预设值
const addPreset = () => {
  if (newPreset.value.trim()) {
    currentPresets.value.push(newPreset.value)
    newPreset.value = ''
  }
}

// 删除预设值
const removePreset = (index: number) => {
  currentPresets.value.splice(index, 1)
}

// 保存预设
const savePresets = async () => {
  try {
    if (!presets.value[activeScene.value]) {
      presets.value[activeScene.value] = {}
    }
    presets.value[activeScene.value][currentEditKey.value] = currentPresets.value
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presets.value)
    })
    if (!response.ok) throw new Error('保存预设失败')
    showPresetDialog.value = false
  } catch (error) {
    console.error('保存预设失败:', error)
  }
}

// 取消编辑预设
const cancelPresets = () => {
  showPresetDialog.value = false
}

// 添加错误处理
window.addEventListener('unhandledrejection', event => {
  // 忽略 Chrome 扩展相关的错误
  if (event.reason?.message?.includes('message port closed')) {
    event.preventDefault()
  }
})

// 添加错误处理
window.addEventListener('error', event => {
  // 忽略 Chrome 扩展相关的错误
  if (event.error?.message?.includes('message port closed')) {
    event.preventDefault()
  }
})
</script>

<template>
  <div class="container">
    <div class="header">
      <h1 class="title">Json编辑器</h1>
      <div class="edit-buttons">
        <!-- 场景编辑按钮组 -->
        <template v-if="!isDataEditMode">
          <template v-if="isSceneEditMode">
            <button 
              @click="saveSceneEdit"
              class="edit-mode-btn save-btn"
            >
              保存场景编辑
            </button>
            <button 
              @click="cancelSceneEdit"
              class="edit-mode-btn cancel-btn"
            >
              取消场景编辑
            </button>
          </template>
          <button 
            v-else
            @click="isSceneEditMode = true"
            class="edit-mode-btn"
          >
            场景编辑
          </button>
        </template>

        <!-- 数据编辑按钮组 -->
        <template v-if="!isSceneEditMode">
          <template v-if="isDataEditMode">
            <button 
              @click="saveDataEdit"
              class="edit-mode-btn save-btn"
            >
              保存数据编辑
            </button>
            <button 
              @click="cancelDataEdit"
              class="edit-mode-btn cancel-btn"
            >
              取消数据编辑
            </button>
          </template>
          <button 
            v-else
            @click="enterDataEditMode"
            class="edit-mode-btn"
          >
            数据编辑
          </button>
        </template>
      </div>
    </div>

    <div class="main-content">
      <div class="scene-container">
        <div 
          v-for="scene in scenes" 
          :key="scene"
          :class="['scene-item', { active: activeScene === scene }]"
        >
          <input 
            v-if="isSceneEditMode"
            :value="scene"
            @blur="e => handleSceneNameChange(scene, e.target.value)"
            class="scene-input"
            type="text"
          >
          <div 
            v-else 
            class="scene-name"
            @click="activeScene = scene"
          >
            {{ scene }}
          </div>
          
          <button 
            v-if="isSceneEditMode"
            @click.stop="confirmDelete(scene)"
            class="delete-btn"
            title="删除场景"
          >
            -
          </button>
        </div>

        <button 
          v-if="isSceneEditMode"
          @click="addDefaultScene" 
          class="add-btn"
          title="添加场景"
        >
          +
        </button>
      </div>

      <div v-if="activeScene" class="data-container">
        <div class="data-header">
          <h2>{{ activeScene }} - 数据</h2>
        </div>
        
        <div class="data-content">
          <div v-if="!isDataEditMode" class="data-view">
            <div v-for="(value, key) in sceneData[activeScene]" :key="key" class="data-item">
              <span class="data-label">{{ key }}:</span>
              <span class="data-value">{{ value }}</span>
            </div>
            <div v-if="!Object.keys(sceneData[activeScene] || {}).length" class="no-data">暂无数据</div>
          </div>
          
          <div v-else class="data-edit">
            <div class="data-row" v-for="(value, key) in tempEditData" :key="key">
              <input 
                :value="key"
                class="data-input"
                readonly
              >
              <select 
                v-model="tempEditData[key]" 
                class="data-select"
              >
                <!-- 修改预设值的访问方式，确保正确访问场景下的预设 -->
                <option 
                  v-for="preset in (presets[activeScene]?.[key] || [])" 
                  :key="preset" 
                  :value="preset"
                >
                  {{ preset }}
                </option>
              </select>
              <button @click="editPresets(key)" class="preset-btn">预设</button>
              <button @click="deleteDataAndPreset(key)" class="delete-data-btn">删除</button>
            </div>
            <div class="add-data-row">
              <input 
                v-model="newDataKey" 
                placeholder="名称"
                class="data-input"
              >
              <input 
                v-model="newDataValue" 
                placeholder="数值"
                class="data-input"
              >
              <button @click="addData" class="add-data-btn">添加</button>
            </div>

            <!-- 为每个键创建独立的预设列表 -->
            <datalist v-for="(presetList, key) in presets" :key="key" :id="`value-presets-${key}`">
              <option v-for="preset in presetList" :key="preset" :value="preset" />
            </datalist>
            <datalist id="value-presets-default">
              <option v-for="preset in presets['默认']" :key="preset" :value="preset" />
            </datalist>

            <!-- 预设编辑对话框 -->
            <div v-if="showPresetDialog" class="preset-dialog">
              <div class="preset-dialog-content">
                <h3>编辑 "{{ currentEditKey }}" 的预设值</h3>
                <div class="preset-list">
                  <div v-for="(preset, index) in currentPresets" :key="index" class="preset-item">
                    <input 
                      v-model="currentPresets[index]"
                      class="data-input"
                    >
                    <button @click="removePreset(index)" class="delete-data-btn">删除</button>
                  </div>
                </div>
                <div class="preset-add-row">
                  <input 
                    v-model="newPreset"
                    placeholder="新预设值"
                    class="data-input"
                  >
                  <button @click="addPreset" class="add-data-btn">添加</button>
                </div>
                <div class="preset-dialog-buttons">
                  <button @click="savePresets" class="save-btn">保存</button>
                  <button @click="cancelPresets" class="cancel-btn">取消</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 20px;
  color: #fff;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  background: #1a1a1a;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #2a2a2a;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.edit-buttons {
  display: flex;
  gap: 12px;
}

.edit-mode-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #3a3a3a;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.save-btn {
  background: #4CAF50;
}

.save-btn:hover {
  background: #45a049;
}

.cancel-btn {
  background: #f44336;
}

.cancel-btn:hover {
  background: #da190b;
}

.main-content {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.scene-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.scene-item {
  position: relative;
  width: 200px;
  height: 40px;
  background: #3a3a3a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  margin-right: 36px;
  transition: all 0.2s ease;
}

.scene-item:hover {
  background: #404040;
  transform: translateY(-2px);
}

.scene-item:active {
  transform: translateY(1px);
}

.scene-item.active {
  background: #4CAF50;
}

.scene-name,
.scene-input {
  flex: 1;
  font-size: 14px;
  color: #fff;
  width: calc(100% - 36px);
}

.scene-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 10px;
  height: 28px;
}

.delete-btn {
  position: absolute;
  right: -36px;
  width: 28px;
  height: 28px;
  background: #f44336;
  border: none;
  border-radius: 4px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-btn {
  width: 40px;
  height: 40px;
  background: #4CAF50;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.data-container {
  background: #3a3a3a;
  border-radius: 8px;
  overflow: hidden;
}

.data-header {
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.data-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.data-content {
  padding: 20px;
}

.data-view {
  padding: 16px;
}

.data-item {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.data-label {
  width: 120px;
  color: #888;
}

.data-value {
  flex: 1;
}

.data-edit {
  padding: 16px;
}

.data-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.data-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 10px;
  color: #fff;
  min-width: 0; /* 防止输入框溢出 */
}

.add-data-row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.delete-data-btn {
  padding: 4px 8px;
  background: #f44336;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.add-data-btn {
  padding: 4px 8px;
  background: #4CAF50;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #888;
}

/* 添加下拉框样式 */
datalist {
  background: #2a2a2a;
  color: #fff;
}

option {
  background: #2a2a2a;
  color: #fff;
  padding: 4px;
}

.preset-btn {
  padding: 4px 8px;
  background: #2196F3;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.preset-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preset-dialog-content {
  background: #2a2a2a;
  padding: 20px;
  border-radius: 8px;
  min-width: 300px;
}

.preset-list {
  margin: 16px 0;
}

.preset-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.preset-add-row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.preset-dialog-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

.data-select {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 10px;
  color: #fff;
  min-width: 0;
  cursor: pointer;
}

.data-select option {
  background: #2a2a2a;
  color: #fff;
}

.data-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.preset-btn {
  padding: 4px 8px;
  background: #2196F3;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.delete-data-btn {
  padding: 4px 8px;
  background: #f44336;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.data-input[readonly] {
  background: rgba(0, 0, 0, 0.3);
  cursor: not-allowed;
}
</style>


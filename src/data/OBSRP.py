import json
import tkinter as tk
from tkinter import messagebox
from obswebsocket import obsws, requests

# ========== OBS WebSocket 配置，根据你的实际情况修改 ========== #
HOST = "localhost"
PORT = 4455
# 如果没有设置密码就不用管，或者把密码去掉；这里示例无密码
# =========================================================== #

# 创建与 OBS WebSocket 的连接对象（全局用）
ws = obsws(HOST, PORT)
refresh_job = None  # 定时任务的ID

def connect_to_obs():
    """
    连接到 OBS
    """
    try:
        ws.connect()
        print("成功连接到 OBS！")
    except Exception as e:
        messagebox.showerror("连接错误", f"无法连接到 OBS: {e}")

def disconnect_from_obs():
    """
    断开与 OBS 的连接
    """
    ws.disconnect()
    print("已断开与 OBS 的连接")

def set_image_source_path(source_name, new_path):
    """
    修改指定图片源的文件路径（5.x API 用 SetInputSettings）
    注意：此源的字段为 "file"，不是 "local_file"
    """
    try:
        response = ws.call(requests.GetInputSettings(inputName=source_name))
        input_settings = response.getInputSettings()
        input_settings["file"] = new_path

        ws.call(requests.SetInputSettings(
            inputName=source_name,
            inputSettings=input_settings,
            overlay=False
        ))

        print(f"已将源「{source_name}」的文件路径改为: {new_path}")
    except Exception as e:
        print(f"无法修改源「{source_name}」的文件路径: {e}")

def refresh_sources():
    selected_primaries = [name for name, var in check_vars.items() if var.get()]
    if not selected_primaries:
        messagebox.showwarning("提示", "请选择至少一个一级菜单！")
        return

    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            for primary in selected_primaries:
                secondary_data = data.get(primary, {})
                for source_name, new_path in secondary_data.items():
                    if new_path:
                        set_image_source_path(source_name, new_path)
            print("选定的源路径已更新")
    except Exception as e:
        messagebox.showerror("错误", f"无法读取 JSON 文件: {e}")

def start_auto_refresh():
    global refresh_job
    interval = int(entry_interval.get()) * 1000  # 转换为毫秒
    refresh_sources()
    refresh_job = root.after(interval, start_auto_refresh)
    entry_interval.config(state='disabled')
    btn_start.config(state='disabled')
    btn_stop.config(state='normal')

def stop_auto_refresh():
    global refresh_job
    if refresh_job is not None:
        root.after_cancel(refresh_job)
        refresh_job = None
        print("自动刷新已停止")
    entry_interval.config(state='normal')
    btn_start.config(state='normal')
    btn_stop.config(state='disabled')

def on_closing():
    stop_auto_refresh()
    disconnect_from_obs()
    root.destroy()

# ============ Tkinter 界面 ============ #
root = tk.Tk()
root.title("OBS 图片自动刷新工具（作者：Kid）")
root.geometry("400x400")  # 设置窗口初始大小

# 连接 OBS
connect_to_obs()

# 从 JSON 加载一级菜单名称
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    primary_names = list(data.keys())

# 创建 Checkbutton
check_vars = {}
for name in primary_names:
    var = tk.BooleanVar()
    check = tk.Checkbutton(root, text=name, variable=var)
    check.pack(anchor='w')
    check_vars[name] = var

# 定时刷新设置
tk.Label(root, text="刷新间隔（秒）:").pack(pady=5)
entry_interval = tk.Entry(root)
entry_interval.pack(pady=5)
entry_interval.insert(0, "1")  # 默认1秒

# 开始和停止按钮
btn_start = tk.Button(root, text="开始自动刷新", command=start_auto_refresh)
btn_start.pack(pady=5)
btn_stop = tk.Button(root, text="停止自动刷新", command=stop_auto_refresh, state='disabled')
btn_stop.pack(pady=5)

root.protocol("WM_DELETE_WINDOW", on_closing)
root.mainloop()
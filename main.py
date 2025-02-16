import os
import sys
import time
from queue import Queue
from threading import Thread

from flask import Flask, request, jsonify
from playwright.sync_api import sync_playwright
from pathlib import Path


app = Flask(__name__)


playwright_instance = None
browser_context = None
task_queue = Queue()
download_dir = Path.home() / 'Downloads'  # 默认下载目录在用户的“下载”文件夹下


def validate_mtag():
    pass
    # mtag = request.headers.get("MTag")  # 获取请求头中的 MTag
    # if not mtag or mtag != "Monster":  # 校验 MTag 是否存在且值为 "Monster"
    #     return jsonify({"code": -1, "message":"未授权的请求"})


@ app.before_request
def before_request_handler():
    error_response = validate_mtag()
    if error_response:  # 如果校验失败，返回错误响应
        return error_response


def get_exe_directory():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))


def set_playwright_path():
    if getattr(sys, 'frozen', False):  # 如果是 PyInstaller 打包后的程序
        base_path = sys._MEIPASS  # 获取临时解压目录
        playwright_browsers_path = os.path.join(base_path, "ms-playwright")
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = playwright_browsers_path
        print(f"PLAYWRIGHT_BROWSERS_PATH 设置为: {playwright_browsers_path}")


def process_tasks():
    global playwright_instance, browser_context

    playwright_instance = sync_playwright().start()
    exe_directory = get_exe_directory()
    user_data_dir = os.path.join(exe_directory, "custom_user_data")
    stable = os.path.join(exe_directory, "tampermonkey_stable")

    # kwargs = dict(
    #     headless=False,
    #     args=[
    #         '--enable-extensions',
    #         f'--disable-extensions-except={stable}',
    #         '--whitelisted-extension-id=dhdgffkkebhmkfjojejmpbldmpobfkfo',
    #         f'--load-extension={stable}',
    #         '--enable-features=ExtensionsToolbarContainer',
    #         '--disable-blink-features=AutomationControlled',
    #         "--enable-features=EnableNewExtensionFeatures"
    #     ],
    #     accept_downloads=True
    # )
    #
    # context = playwright_instance.chromium.launch_persistent_context(
    #     user_data_dir,
    #     **kwargs
    # )

    # def handle_popup(popup):
    #     if "chrome-extension" in popup.url:
    #         if popup.title() == "修改用户脚本":
    #             enable_locator = "#input_LyhfdW5kZWZpbmVk_bu"
    #             popup.locator(enable_locator).click()
    #
    # context.on("page", handle_popup)

    # page = context.pages[0]
    context = playwright_instance.chromium.connect_over_cdp("http://localhost:9223")
    page = context.new_page()
    url = "https://business.mhdyp.com/#/discharge/index"
    page.goto(url)
    browser_context = context

    while True:
        task = task_queue.get()
        if task is None:
            break
        page = browser_context.new_page()
        page.goto(task['url'])
        time.sleep(0.5)
        action = task.pop("action", None)
        if action:
            try:
                action(page, task)
            except:
                pass


@app.route('/find_by_image', methods=['GET'])
def find_by_image():
    # data = request.get_json()
    # username = data.get('username', None)
    # desc = data.get('username', None)
    # filename = data.get('filename', None)

    # file_path = os.path.join(download_dir, filename)  # 替换为你的文件路径
    # if not username:
    #     return jsonify({"message": "无用户名，无法上传", "code": -1})
    # if not os.path.exists(file_path):
    #     return jsonify({"message": "找不到待识别图片", "code": -1})

    url = "https://business.mhdyp.com/#/discharge/index"
    task_queue.put({
        'url': url,
        "action": upload_file2MH,
        # "file_path": file_path,
        # "username": username,
        # "desc": desc,
    })
    return jsonify({"message": "成功", "code": 0})


@app.route('/find_by_desc', methods=['POST'])
def find_by_desc():
    data = request.get_json()
    desc = data.get('username', None)

    if not desc:
        return jsonify({"message": "无描述内容", "code": -1})

    url = "https://business.mhdyp.com/#/discharge/index"
    task_queue.put({
        'url': url,
        "action": click2fastTab,
        "desc": desc,
    })
    return jsonify({"message": "成功", "code": 0})


def upload_file2MH(page, kwargs):
    e = page.get_by_text('识别下单')
    e.click()
    file_input = page.query_selector('input[type="file"]')
    desc = kwargs.get("desc", None)
    file_path = kwargs.get("file_path", None)

    if file_input:
        file_input.set_input_files(file_path)
        print("文件已设置，等待上传完成...")
    else:
        print("未找到文件输入元素")
        return
    failed_parent_locator = None
    try:
        failed_parent_locator = page.locator('xpath=//p[contains(text(), "识别失败！")]/..')
    except:
        pass
    if failed_parent_locator:
        e = failed_parent_locator.get_by_text('我知道了')
        e.click()
        click2fastTab(page, desc)

def click2fastTab(page, input_value):
    e = page.get_by_text('快速下单')
    e.click()
    input_element = page.query_selector('input[placeholder="请输入城市和影院等关键词"][type="text"]')
    input_element.fill(input_value)


if __name__ == '__main__':
    set_playwright_path()
    Thread(target=process_tasks, daemon=True).start()
    time.sleep(3)
    app.run(
        host="localhost",
        port=5001,
        debug=True,
        use_reloader=False
    )

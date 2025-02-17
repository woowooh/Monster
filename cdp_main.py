import os
import time
from queue import Queue, Empty
from threading import Thread
import traceback

from requests import Session
from flask import Flask, request, jsonify
from playwright.sync_api import sync_playwright
from pathlib import Path

app = Flask(__name__)
session = Session()

playwright_instance = None
browser_instance = None
browser_context = None
task_queue = Queue()
download_dir = Path.home() / 'Downloads'  # 默认下载目录在用户的“下载”文件夹下


@app.after_request
def after_request(response):
    # 设置允许跨域的来源（* 表示允许所有来源）
    response.headers.add('Access-Control-Allow-Origin', 'http://im.liangpiao.net.cn')

    # 设置允许的 HTTP 方法
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    # 设置允许的请求头
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, MTag')

    return response


def validate_mtag():
    mtag = request.headers.get("MTag")  # 获取请求头中的 MTag
    if not mtag or mtag != "Monster":  # 校验 MTag 是否存在且值为 "Monster"
        return jsonify({"code": -1, "message": "未授权的请求"})


@app.before_request
def before_request_handler():
    error_response = validate_mtag()
    if error_response:  # 如果校验失败，返回错误响应
        return error_response


def process_tasks():
    global playwright_instance, browser_context, browser_instance
    playwright_instance = sync_playwright().start()

    try:
        browser_instance = playwright_instance.chromium.connect_over_cdp("http://localhost:9223")
        context = browser_instance.contexts[0]
        page = context.new_page()
        url = "https://business.mhdyp.com/#/discharge/index"
        page.goto(url)
        browser_context = context
    except Exception as e:
        print("Init connect failed", str(e))
        traceback.print_exc()

    while True:
        try:
            task = task_queue.get(timeout=0.5)
            if task is None:
                break
            get_available_browser()
            action = task.pop("action", None)
            if action:
                try:
                    page = browser_context.new_page()
                    page.goto(task['url'])
                    time.sleep(0.5)
                    action(page, task)
                except Exception as e:
                    traceback.print_exc()
        except Empty:
            get_available_browser()


def get_available_browser():
    global browser_context, browser_instance
    try:
        context = browser_instance.new_context()
        context.close()
    except Exception as e:
        if "browser has been closed" in str(e) or "new_context" in str(e) or "connect ECONNREFUSED" in str(e):
            try:
                browser_instance = playwright_instance.chromium.connect_over_cdp("http://localhost:9223")
                browser_context = browser_instance.contexts[0]
            except Exception as e:
                print("Reconnect failed")


def download_image(image_url, file_name):
    try:
        headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        }
        response = session.get(image_url, headers=headers, stream=True)

        # 检查请求是否成功
        if response.status_code == 200:
            # 打开文件以二进制写入模式保存图片数据
            with open(file_name, 'wb') as file:
                for chunk in response.iter_content(1024):  # 分块写入文件
                    file.write(chunk)
            print(f"图片已成功下载并保存为 {file_name}")
        else:
            print(f"下载失败，HTTP 状态码: {response.status_code} {response.text}")

    except Exception as e:
        print(f"下载图片时出错: {e}")


@app.route('/find_by_image', methods=['POST'])
def find_by_image():
    data = request.get_json()
    image_url = data.get('imgUrl', None)
    filename = data.get('filename', None)

    file_path = os.path.join(download_dir, filename)  # 替换为你的文件路径
    download_image(image_url, file_path)

    url = "https://business.mhdyp.com/#/discharge/index"
    task_queue.put({
        'url': url,
        "action": upload_file2MH,
        "file_path": file_path,
        # "username": username,
        # "desc": desc,
    })
    return jsonify({"message": "成功", "code": 0})


@app.route('/find_by_desc', methods=['POST'])
def find_by_desc():
    data = request.get_json()
    desc = data.get('desc', None)

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
    file_path = kwargs.get("file_path", None)

    if file_input:
        file_input.set_input_files(file_path)
        print("文件已设置，等待上传完成...")
    else:
        print("未找到文件输入元素")
        return
    # failed_parent_locator = None
    # try:
    #     failed_parent_locator = page.locator('xpath=//p[contains(text(), "识别失败！")]/..')
    # except:
    #     pass
    # if failed_parent_locator:
    #     e = failed_parent_locator.get_by_text('我知道了')
    #     e.click()
    #     click2fastTab(page, desc)


def click2fastTab(page, kwargs):
    desc = kwargs.get("desc", None)

    e = page.get_by_text('快速下单')
    e.click()
    input_element = page.query_selector('input[placeholder="请输入城市和影院等关键词"][type="text"]')
    input_element.fill(desc)


if __name__ == '__main__':
    Thread(target=process_tasks, daemon=True).start()
    time.sleep(3)
    app.run(
        host="localhost",
        port=5001,
        debug=True,
        use_reloader=False
    )
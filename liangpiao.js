// ==UserScript==
// @name         粮票
// @namespace    http://tampermonkey.net/
// @version      2025-02-15a
// @description  try to take over the world!
// @author       You
// @match        *://im.liangpiao.net.cn/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
  'use strict';

  function sendHttpRequest(method, url, data, onSuccess, onError) {
    GM_xmlhttpRequest({
      method: method,
      url: url,
      headers: {
        "Content-Type": "application/json",
        "MTag": "Monster"
      },
      data: method === 'POST' ? JSON.stringify(data) : undefined,
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          onSuccess(response.responseText);
        } else {
          if (onError) {
            onError('请求失败，状态码: ' + response.status);
          }
        }
      },
      onerror: function(error) {
        if (onError) {
          onError('请求发生错误: ' + error);
        }
      }
    });
  }


  async function sendImageToBackend(filename, imgUrl) {
    try {
      // 第一步：获取图片资源
      const backendUrl = "http://localhost:5001/upload_image"
      const response = await fetch(imgUrl);
      if (!response.ok) {
        createFlashMessage("下载图片失败", "error")
        return
      }

      // 第二步：将响应转换为 Blob
      const blob = await response.blob();

      // 第三步：创建 FormData 对象并将 Blob 添加到其中
      const formData = new FormData();
      formData.append('file', blob, filename); // 'image.jpg' 是文件名，可以根据需要修改

      // 第四步：将图片发送到后端
      const uploadResponse = await fetch(backendUrl, {
        headers: {
          "MTag": "Monster"
        },
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        createFlashMessage("图片上传失败", "error")
      }

      // 第五步：处理后端返回的结果
      const result = await uploadResponse.json(); // 假设后端返回 JSON 数据
      if (result.code !== 0) {
        createFlashMessage(`错误:${result.message}`, "error")
      }
      return result;
    } catch (error) {
      console.error("上传失败:", error.message);
      return Promise.reject(error.message);
    }
  }


  function createAndAppendElement(tag, attributes, styles) {
    var element = document.createElement(tag);
    for (var attr in attributes) {
      element[attr] = attributes[attr];
    }
    for (var style in styles) {
      element.style[style] = styles[style];
    }
    document.body.appendChild(element);
    return element;
  }


  function sendImage2Monster(username, filename, desc) {
    const url = "http://localhost:5001/find_by_image"
    const data = {
      "username": username,
      "filename": filename,
    }
    sendHttpRequest('POST', url, data,
                    function(responseText) {
                      var jsonRet = JSON.parse(responseText);
            var code = jsonRet.code
            if (code !== 0) {
                createFlashMessage(`错误:${jsonRet.message}`, "error")
            } else {
                createFlashMessage("提交成功", "success")
            }
        },
        function(errorMessage) {
            alert(errorMessage);
        }
    );
}

function sendDesc2Monster(desc) {
    const url = "http://localhost:5001/find_by_desc"
    const data = {
        "desc": desc
    }
    sendHttpRequest('POST', url, data,
        function(responseText) {
            var jsonRet = JSON.parse(responseText);
            var code = jsonRet.code
            if (code !== 0) {
                createFlashMessage(`错误:${jsonRet.message}`, "error")
            } else {
                createFlashMessage("提交成功", "success")
            }
        },
        function(errorMessage) {
            alert(errorMessage);
        }
    );
}

function createFlashMessage(message, type = "success", duration = 1500) {
    const colors = {
        success: "#4caf50",
        warning: "#ff9800",
        error: "#f44336"
    };

    const attributes = {
        innerHTML: message,
        className: "flash-message"
    };
    const styles = {
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "10px 20px",
        background: colors[type] || colors.success,
        color: "#fff",
        borderRadius: "5px",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
        zIndex: "9999"
    };

    const flashElement = createAndAppendElement("div", attributes, styles);
    setTimeout(() => {
        document.body.removeChild(flashElement);
    }, duration);
}

    let sendDescButton = null;
    let sendImgButton = null

    // 创建自定义菜单项
    function createSendDescButton(event) {
        const selectionText = window.getSelection().toString().trim();
        if (!selectionText) return; // 如果没有选中文本，则不显示自定义选项

        // 移除之前的自定义菜单（如果存在）
        if (sendDescButton !== null) {
            document.body.removeChild(sendDescButton);
        }

        sendDescButton = document.createElement('button');
        sendDescButton.innerHTML = "提交麻花文字"
        sendDescButton.style.position = "fixed"
        sendDescButton.style.top = `${event.clientY - 50}px`; // 调整位置以避免覆盖原生菜单
        sendDescButton.style.left = `${event.clientX + 100}px`;
        sendDescButton.style.zIndex = '1000';


        // 添加点击事件
        sendDescButton.addEventListener('click', () => {
            try {
            sendDesc2Monster(selectionText); // 发送选中的文本到服务器
            document.body.removeChild(sendDescButton); // 关闭自定义菜单
            sendDescButton = null
            createFlashMessage("提交成功", "success")
            } catch (error) {
            createFlashMessage(error, "error")
            document.body.removeChild(sendDescButton); // 关闭自定义菜单
            sendDescButton = null
            }

        });

        // 添加到页面
        document.body.appendChild(sendDescButton);

        // 监听点击事件以关闭菜单
        document.addEventListener('click', () => {
            if (sendDescButton) {
                document.body.removeChild(sendDescButton);
                sendDescButton = null;
            }
        }, { once: true });
    }

    var getDatetime = () => {
        const now = new Date(); // 获取当前日期
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return `${year}-${month}-${day}`;
    }


    function createSendImageButton(event, target) {

        // 移除之前的自定义菜单（如果存在）
        if (sendImgButton !== null) {
            document.body.removeChild(sendImgButton);
        }

        // 创建自定义菜单项
        sendImgButton = document.createElement('button');
        sendImgButton.innerHTML = "提交麻花图片"
        sendImgButton.style.position = "fixed"

        sendImgButton.style.top = `${event.clientY - 80}px`; // 调整位置以避免覆盖原生菜单
        sendImgButton.style.left = `${event.clientX + 100}px`;
        sendImgButton.style.zIndex = '1000';
        const img_url = target.src
        sendImgButton.onclick = async function() {
            const e = document.querySelector('div.chat-header.tui-chat-header > div.chat-header-container > div.chat-header-content > div:nth-child(1) > span:nth-child(1)');
            const username = e.textContent
            const filename = `${username}-${getDatetime()}.jpg`
            try {
                // 使用 await 等待 performDownload 完成
                await sendImageToBackend(filename, img_url);
                sendImage2Monster(username, filename);
                if (sendImgButton != null) {
                    document.body.removeChild(sendImgButton); // 关闭自定义菜单
                    sendImgButton = null
                }
                createFlashMessage("提交成功", "success")
            } catch (error) {
                document.body.removeChild(sendImgButton); // 关闭自定义菜单
                sendImgButton = null
                createFlashMessage(error, "error")
                console.error("Error occurred:", error);
            }
        }

        // 添加到页面
        document.body.appendChild(sendImgButton);

        // 监听点击事件以关闭菜单
        document.addEventListener('click', () => {
            if (sendImgButton !== null) {
                document.body.removeChild(sendImgButton);
                sendImgButton = null;
            }
        }, { once: true });
    }


    // 监听右键事件
    document.addEventListener('contextmenu', (event) => {
        const target = findImageInChildren(event.target);
        if (target) {
            // 如果找到了 img 子元素，执行操作
            createSendImageButton(event, target);
        } else {
            createSendDescButton(event); // 创建自定义菜单项
        }
    });

    function findImageInChildren(element) {
    if (!element || !element.children) return null; // 如果没有子元素，返回 null

    // 遍历所有子元素
    for (const child of element.children) {
        if (child.tagName.toLowerCase() === 'img') {
            return child; // 找到 img 子元素，返回
        }

        // 递归查找子元素的子树
        const result = findImageInChildren(child);
        if (result) return result; // 如果找到 img，返回
    }
    return null; // 没有找到 img，返回 null
}

})();
// ==UserScript==
// @name         麻花后台
// @namespace    http://tampermonkey.net/
// @version      2025-02-07
// @description  try to take over the world!
// @author       You
// @match        *://business.mhdyp.com*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

function getMessageToSend(ticketCode, verifyCode) {
    // 定义基础消息模板
    const baseMessage = `已出票成功，如自助机无法扫码出票，请输入【%s】取票；如还不行，请联系前台工作人员取票并打开手机录音；如工作人员告知你无法出票，请将该段对话内容录音保存（尽量包含场次信息等），凭录音申请退款。请不要擅自在影院退票，否则后果自负！如票出错了 回复“004” 取票码无法取票 回复“005” 常见问题 回复“999”`;

    // 根据 ticketCode 和 verifyCode 的存在情况生成相应的取票信息
    let ticketInfo = '';
    if (ticketCode && verifyCode) {
        ticketInfo = `取票码：${ticketCode} 取票验证码：${verifyCode}`;
    } else if (ticketCode) {
        ticketInfo = `取票码：${ticketCode}`;
    } else if (verifyCode) {
        ticketInfo = `取票验证码：${verifyCode}`;
    } else {
        ticketInfo = '未提供取票码或取票验证码，请检查输入';
        return ticketInfo
    }
    return baseMessage.replace('%s', ticketInfo);
}

function autoClickMinimumDiscountElement(selector) {
        // 使用适当的CSS选择器查找所有目标元素
        var targetElements = document.querySelectorAll(selector);

        if (targetElements.length === 0) {
            console.error('未找到任何折扣元素');
            return;
        }

        let minDiscount = Infinity;
        let minDiscountElement = null;

        targetElements.forEach(element => {
            const discountText = element.querySelector('p').textContent.trim();
            const discountValue = parseFloat(discountText.replace(/[^0-9.]/g, ''));

            if (!isNaN(discountValue) && discountValue < minDiscount) {
                minDiscount = discountValue;
                minDiscountElement = element;
            }
        });

        if (minDiscountElement) {
            var clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true
            });
            minDiscountElement.dispatchEvent(clickEvent);
            console.log(`已自动点击最小折扣元素：${minDiscount}折`);
        } else {
            console.error('未能识别任何有效的折扣值');
        }
    }

// 全局变量

// 发送 HTTP 请求的通用函数（基于 Promise）
function sendHttpRequest(method, url, data) {
    return new Promise((resolve, reject) => {
        const timeNow = Date.now();
        const token = localStorage.getItem('token');

        GM_xmlhttpRequest({
            method: method,
            url: url,
            headers: {
                "Content-Type": "application/json",
                "Txntime": timeNow,
                "Channelid": "C00001",
                "token": token
            },
            data: method === 'POST' ? JSON.stringify(data) : undefined,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const json = JSON.parse(response.responseText); // 尝试解析为 JSON
                        resolve(json); // 成功时返回解析后的数据
                    } catch (error) {
                        reject(`响应数据解析失败: ${error.message}`); // 如果解析失败，返回错误
                    }
                } else {
                    reject(`请求失败，状态码: ${response.status}`); // 状态码不在 200-299 范围内时返回错误
                }
            },
            onerror: function (error) {
                reject(`请求发生错误: ${error}`); // 请求发生错误时返回错误
            }
        });
    });
}


// 展示错误信息的通用函数
function showError(message) {
    modalBox.textContent = message;
    showCustomModal();
}


// 数据请求的封装函数
function fetchData(url, data) {
    return sendHttpRequest('POST', url, data);
}

// 获取订单信息
function getTickInfo(ticketId, more) {
    const url = "https://business.mhdyp.com/api/movie-server/movie/put/in/list";
    const data = {
        "tag": "0",
        "nowId": "",
        "putOrderId": ticketId,
        "outId": "",
        "cinemaName": ""
    };

    // 请求数据
    fetchData(url, data)
        .then(response => handleTickInfoResponse(response, ticketId, more)) // 处理响应
        .catch(error => showError(`请求失败: ${error}`));
}


// 获取详细信息
function getDetail(ticketId) {
    const url = "https://business.mhdyp.com/api/movie-server/movie/put/in/query";
    const data = { "putOrderId": ticketId };

    // 请求数据
    fetchData(url, data)
        .then(handleDetailResponse) // 处理响应
        .catch(error => showError(`请求失败: ${error}`));
}


// 处理订单信息的响应
function handleTickInfoResponse(response, ticketId, more) {
    const rtnCode = response.rtnCode;
    if ((rtnCode !== "000000") && more) {
        showError(`${response.rtnMsg}。请刷新页面`);
    } else {
        const rtnData = response.rtnData;
        if ((rtnData.length === 0) && more ) {
            showError("未找到订单信息，请确认订单号无误");
        } else if ((rtnData.length > 1) && more) {
            alert('出现多笔订单');
        } else {
            if (more) {
                getDetail(rtnData[0].id); // 继续获取详细信息
            } else {
                if ((rtnData[0].tickets?.length > 0) || ((rtnData[0]?.tickets === null) && rtnData[0].note !== null)) {
                    removePendingItemByTicketId(ticketId);
                    addProcessedItem({text: ticketId});
                }
            }
        }
    }
}

function removePendingItemByTicketId(ticketId) {
    console.log(pendingItems)
    pendingItems = pendingItems.filter(item => item.text.trim() !== ticketId);
    saveData(); // 保存到 localStorage
    renderPendingItems(); // 重新渲染待处理列表
}

// 处理详细信息的响应
    function handleDetailResponse(response) {
        const rtnCode = response.rtnCode;
        if (rtnCode !== "000000") {
            showError(`${response.rtnMsg}。请刷新页面`);
        } else {
            const rtnData = response.rtnData;
            const tickets = rtnData.tickets;

            if (tickets.length === 0) {
                showError(`${rtnData.putOrderId} ${rtnData.note} 可能报价中或待出票`);
            } else {
                renderTicketsToModal(rtnData.putOrderId, tickets); // 渲染数据
                showCustomModal(); // 显示模态框
            }
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

    const [modalBackground, modalBox] = createModalComponents();

    function renderTicketsToModal(ticketId, tickets) {
        let counter = 1;
        modalBox.innerHTML = ''; // 清空之前的模态框内容

        tickets.forEach(ticket => {
            const ticketDiv = createTicketDiv(ticketId, ticket, counter++);
            modalBox.appendChild(ticketDiv);
        });
    }

    function showCustomModal() {
        modalBackground.style.display = 'flex';
    }

    function createModalComponents() {
        const background = createModalBackground();
        const box = createModalBox();
        const closeButton = createCloseButton(closeCustomModal);

        background.addEventListener('click', function(event) {
            if (event.target === background) {
                closeCustomModal();
            }
        });


        box.appendChild(closeButton);
        background.appendChild(box);
        document.body.appendChild(background);

        return [background, box];
    }

    function closeCustomModal() {
        modalBackground.style.display = 'none';
    }

    function createTicketDiv(ticketId, ticket, index) {
        const div = createElementWithStyles('div', {marginBottom: '20px'});
        var sep = '|'
        if (ticket.ticketInfo.includes(sep)) {
           var [ticketCode, verifyCode] = ticket.ticketInfo.split(sep)
           div.appendChild(createTextElement('p', `取票码: ${ticketCode}`, {margin: '5px 0'}));
           div.appendChild(createTextElement('p', `验证码: ${verifyCode}`, {margin: '5px 0'}));
        } else {
            div.appendChild(createTextElement('p', `取票码: ${ticket.ticketInfo}`, {margin: '5px 0'}));
        }

        const imgElement = createImageElement(ticket.ticketImg);
        div.appendChild(imgElement);
        div.appendChild(createDownloadButton(ticketId, ticket.ticketImg, index));
        var copyButton = createCopyButton(div, ticket.ticketInfo)
        var copyTemplateButton = createTemplateCopyButton(div, ticket.ticketInfo)

        div.appendChild(copyButton);
        div.appendChild(copyTemplateButton);
        return div;
    }

    function showNotification(parent, message) {
        const notification = document.createElement('div');
        notification.style.position = 'relative';
        notification.style.color = '#FFA500'; // 白色文字
        notification.style.borderRadius = '5px'; // 圆角
        notification.textContent = message;
        parent.appendChild(notification);
    }

    function createTextElement(tag, textContent, styles) {
        const element = document.createElement(tag);
        element.textContent = textContent;
        applyStyles(element, styles);
        return element;
    }

    function createImageElement(src) {
        const img = createElementWithStyles('img', {
            maxWidth: '100%', // 确保图片不会超出其容器宽度
            maxHeight: '200px', // 设置最大高度，可根据需要调整
            objectFit: 'contain', // 保持图片比例的同时适应指定的宽高
            cursor: 'pointer'
        });
        img.src = src;
        img.onclick = () => window.open(src, '_blank'); // 点击图片时，在新标签页打开原图
        return img;
    }

    function createDownloadButton(ticketId, src, index) {
        const button = createElementWithStyles('button', {}, '下载图片');
        button.onclick = () => downloadImage(src, `${ticketId}-${index}.jpg`);
        return button;
    }

    function createCopyButton(div, text) {
        var sep = '|';
        const button = createElementWithStyles('button', {}, '复制取票码');
        var message = concatenateTicketInfo(text, sep)
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(message);
                showNotification(div, '复制成功');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showNotification(div, '复制失败，请重试');
            }
        });
        return button;
    }

    function concatenateTicketInfo(text, sep) {
        let ticketCode, verifyCode;

        if (text.includes(sep)) {
            // 如果包含分隔符，则进行分割
            [ticketCode, verifyCode] = text.split(sep);
        } else {
            // 如果不包含分隔符，则整个文本作为 ticketCode
            ticketCode = text;
            verifyCode = undefined;
        }

        let infoParts = [];

        if (ticketCode && ticketCode.trim() !== "") {
            infoParts.push(`取票码: ${ticketCode}`);
        }

        if (verifyCode && verifyCode.trim() !== "") {
            infoParts.push(`验证码: ${verifyCode}`);
        }

        return infoParts.join(", ") || "未提供取票码或取票验证码，请检查输入";
    }

    function createTemplateCopyButton(div, text) {
        var sep = '|';
        var [ticketCode, verifyCode] = text.split(sep)
        var message = getMessageToSend(ticketCode, verifyCode)
        const button = createElementWithStyles('button', {}, '复制话术');
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(message);
                showNotification(div, '复制成功');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showNotification(div, '复制失败，请重试');
            }
        });
        return button;
    }

    function downloadImage(url, filename) {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            })
            .catch(() => alert('下载失败'));
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
        }).catch(err => alert(`复制取票码失败: ${err}`));
    }

    function createElementWithStyles(tag, styles = {}, textContent = '') {
        const element = document.createElement(tag);
        element.textContent = textContent;
        applyStyles(element, styles);
        return element;
    }

    function applyStyles(element, styles) {
        for (const key in styles) {
            if (styles.hasOwnProperty(key)) {
                element.style[key] = styles[key];
            }
        }
    }

    function createModalBackground() {
        return createElementWithStyles('div', {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'none',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '10000'
        });
    }

    function createModalBox() {
        return createElementWithStyles('div', {
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            maxWidth: '90%',
            maxHeight: '90%',
            overflowY: 'auto',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start' // 调整以适应图片等元素的布局
        });
    }

    function createCloseButton(onClick) {
        const button = createElementWithStyles('button', {
            position: 'absolute',
            top: '10px',
            right: '10px',
            fontSize: '16px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer'
        }, '×');

        button.onclick = onClick;

        return button;
    }

    var input = createAndAppendElement("input", {
        type: "text",
        placeholder: "输入订单号"
    }, {
        position: "fixed",
        top: "15px",
        right: "500px",
        zIndex: "1000",
        width: "200px",
        padding: "5px"
    });

    var button = createAndAppendElement("button", {
        innerHTML: "查询订单详情"
    }, {
        position: "fixed",
        top: "15px",
        right: "400px",
        zIndex: "1000"
    });
    button.onclick = function() {
        var inputValue = input.value.trim(); // 获取输入框的值
        if (inputValue !== "") {
            getTickInfo(inputValue, true);
        }
    };

    var buttonFillTicket = createAndAppendElement("button", {
        innerHTML: "填充订单信息"
    }, {
        position: "fixed",
        top: "40px",
        right: "30px",
        zIndex: "99999"
    });
    buttonFillTicket.onclick = function() {
        autoClickMinimumDiscountElement('.allcenter.hand.discount-none');
        var nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        updateDateTimePicker();
        clickRead()
    };

    function findVueInstanceFromElement(element) {
        // 如果当前元素有__vue__属性，则返回它
        if (element.__vue__) {
            return element.__vue__;
        }
        // 否则，向上遍历父节点寻找
        let currentNode = element;
        while (currentNode.parentNode) {
            currentNode = currentNode.parentNode;
            if (currentNode.__vue__) {
                return currentNode.__vue__;
            }
        }
        return null;
    }

    function setDateTime(dateStr, timeStr) {
        var dateInput = document.querySelector('input.el-input__inner[placeholder="选择日期"]');
        var timeInput = document.querySelector('input.el-input__inner[placeholder="选择时间"]');

        if (!dateInput || !timeInput) {
            console.error('无法找到日期或时间输入框');
            return;
        }

        dateInput.value = dateStr;
        timeInput.value = timeStr;

        ['input', 'change'].forEach(eventType => {
            var dateEvent = new Event(eventType, { bubbles: true });
            var timeEvent = new Event(eventType, { bubbles: true });

            dateInput.dispatchEvent(dateEvent);
            timeInput.dispatchEvent(timeEvent);
        });

        var confirmButton = Array.from(document.querySelectorAll('.el-button.el-picker-panel__link-btn'))
                             .find(btn => btn.textContent.trim() === '确定');
        if (!confirmButton) {
            console.error('无法找到确定按钮');
            return;
        }
        confirmButton.click();
    }

    function clickOk() {
        var confirmButton = Array.from(document.querySelectorAll('.el-button.el-picker-panel__link-btn'))
        .find(btn => btn.textContent.trim() === '确定');

        if (confirmButton) {
            confirmButton.click();
            console.log("已点击确认按钮");
        } else {
            console.error('无法找到确定按钮');
        }
    }

    async function updateDateTimePicker() {
        var datePickerVueInstance = document.querySelector('.el-date-editor').__vue__;

        if (!datePickerVueInstance) {
            console.error('Date picker Vue instance not found.');
            return;
        }
        //datePickerVueInstance.showPicker()
        var today = new Date();
        var nextHour = new Date(today.getTime() + 60 * 60 * 1000); // 当前时间加1小时

        var formattedDate = today.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'); // YYYY-MM-DD
        var formattedTime = nextHour.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); // HH:mm:ss

        try {

            if (datePickerVueInstance) {
                if (datePickerVueInstance.picker && typeof datePickerVueInstance.picker.value === 'object') {
                    datePickerVueInstance.picker.value = nextHour; // 直接传递 Date 对象
                } else {
                    datePickerVueInstance.value = formattedDate + ' ' + formattedTime; // 或者直接使用 nextHour 如果组件支持
                }
                datePickerVueInstance.$emit('input', nextHour); // 确保这里传递的数据类型与组件期望的一致
                console.log('Date picker value set to:', formattedDate + ' ' + formattedTime);
            } else {
                console.error('Date picker Vue instance not found.');
            }
        } catch (e) {
            console.error('Error updating date picker value:', e);
        }
    }

    function clickRead() {
        var allPTags = document.querySelectorAll('div.el-dialog__body >.justify >.allcenter.hand > p')

        var targetElement = null;

        allPTags.forEach(function(pTag) {
            if (pTag.textContent.trim() === '已读') {
                targetElement = pTag;
            }
        });

        if (targetElement) {
            var clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true
            });

            if (targetElement.dispatchEvent(clickEvent)) {
                console.log('Clicked 已读 successfully.');
            } else {
                console.error('The click event was not successful.');
            }
        } else {
            console.error('Target element with text "已读" not found.');
        }
    }



    let pendingItems = []; // 待处理项数组
    let processedItems = []; // 已处理项数组

    const STORAGE_KEY_PENDING = 'pendingItems';
    const STORAGE_KEY_PROCESSED = 'processedItems';

    let pendingTable; // 待处理表格
    let processedTable; // 已处理表格

    // 初始化数据
    function initializeData() {
        try {
            const savedPending = JSON.parse(localStorage.getItem(STORAGE_KEY_PENDING));
            const savedProcessed = JSON.parse(localStorage.getItem(STORAGE_KEY_PROCESSED));
            if (Array.isArray(savedPending)) {
                pendingItems = savedPending;
            }
            if (Array.isArray(savedProcessed)) {
                processedItems = savedProcessed;
            }
        } catch (error) {
            console.error('LocalStorage 数据解析失败:', error);
        }
    }

    // 保存数据到 localStorage
    function saveData() {
        localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(pendingItems));
        localStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(processedItems));
    }

    // 创建右下角的表格容器
    function createTable() {
        const container = document.createElement('div');
        container.id = 'customTableContainer';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.backgroundColor = '#f9f9f9';
        container.style.border = '1px solid #ccc';
        container.style.padding = '10px';
        container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        container.style.zIndex = '9999';
        container.style.width = '300px';
        container.style.fontFamily = 'Arial, sans-serif';

        // 标题
        const title = document.createElement('h3');
        title.style.marginBottom = '10px';
        container.appendChild(title);

        // 输入框和按钮
        const inputDiv = document.createElement('div');
        inputDiv.style.display = 'flex';
        inputDiv.style.gap = '10px';
        inputDiv.style.marginBottom = '10px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '请输入内容';
        input.style.flex = '1';
        input.style.padding = '5px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';

        const addButton = document.createElement('button');
        addButton.textContent = '添加';
        addButton.style.padding = '5px 10px';
        addButton.style.border = 'none';
        addButton.style.backgroundColor = '#007bff';
        addButton.style.color = '#fff';
        addButton.style.cursor = 'pointer';
        addButton.style.borderRadius = '4px';
        addButton.addEventListener('click', () => {
            const text = input.value.trim();
            if (text) {
                addPendingItem(text);
                input.value = ''; // 清空输入框
            }
        });
        // 输入框监听回车键
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { // 检测是否按下了 Enter 键
                const text = input.value.trim();
                if (text) {
                    addPendingItem(text);
                    input.value = ''; // 清空输入框
                }
                event.preventDefault(); // 阻止默认行为（避免页面刷新等）
            }
        });


        inputDiv.appendChild(input);
        inputDiv.appendChild(addButton);
        container.appendChild(inputDiv);

        // 待处理表格
        const pendingSection = createTableSection('等结果');
        pendingTable = pendingSection.querySelector('table');
        container.appendChild(pendingSection);

        // 已处理表格
        const processedSection = createTableSection('已完成');
        processedTable = processedSection.querySelector('table');
        container.appendChild(processedSection);

        document.body.appendChild(container);
    }

    // 创建表格部分
    function createTableSection(title) {
        const section = document.createElement('div');
        section.style.marginBottom = '10px';

        const header = document.createElement('div');
        header.textContent = title;
        header.style.fontSize = '13px';
        header.style.marginBottom = '5px';
        section.appendChild(header);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        section.appendChild(table);

        return section;
    }

    // 添加待处理项
    function addPendingItem(text) {
        pendingItems.push({ text });
        saveData(); // 保存到 localStorage
        renderPendingItems();
    }

    // 移除待处理项
    function removePendingItem(index) {
        pendingItems.splice(index, 1);
        saveData(); // 保存到 localStorage
        renderPendingItems();
    }

    // 添加已处理项
    function addProcessedItem(item) {
        processedItems.push({ ...item});
        saveData(); // 保存到 localStorage
        renderProcessedItems();
    }

    // 移除已处理项
    function removeProcessedItem(index) {
        processedItems.splice(index, 1);
        saveData(); // 保存到 localStorage
        renderProcessedItems();
    }

    // 渲染待处理表格
    function renderPendingItems() {
        if (!pendingTable) return;
        pendingTable.querySelector('tbody').innerHTML = ''; // 清空表格
        pendingItems.forEach((item, index) => {
            const row = document.createElement('tr');

            const contentCell = document.createElement('td');
            contentCell.textContent = item.text;
            contentCell.style.border = '1px solid #ccc';
            contentCell.style.padding = '5px';

            const actionCell = document.createElement('td');
            const moveButton = document.createElement('button');
            moveButton.textContent = '手动完成';
            moveButton.style.padding = '3px 5px';
            moveButton.style.border = 'none';
            moveButton.style.backgroundColor = '#28a745';
            moveButton.style.color = '#fff';
            moveButton.style.cursor = 'pointer';
            moveButton.style.borderRadius = '4px';
            moveButton.addEventListener('click', () => {
                addProcessedItem(item); // 移动到已处理
                removePendingItem(index); // 从待处理移除
            });
            actionCell.appendChild(moveButton);
            actionCell.style.textAlign = 'center';

            row.appendChild(contentCell);
            row.appendChild(actionCell);

            pendingTable.querySelector('tbody').appendChild(row);
        });
    }

    // 渲染已处理表格
    function renderProcessedItems() {
        if (!processedTable) return;
        processedTable.querySelector('tbody').innerHTML = ''; // 清空表格
        processedItems.forEach((item, index) => {
            const row = document.createElement('tr');

            const contentCell = document.createElement('td');
            contentCell.textContent = item.text;
            contentCell.style.border = '1px solid #ccc';
            contentCell.style.padding = '5px';

            const actionCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.style.padding = '3px 5px';
            deleteButton.style.border = 'none';
            deleteButton.style.backgroundColor = '#dc3545';
            deleteButton.style.color = '#fff';
            deleteButton.style.cursor = 'pointer';
            deleteButton.style.borderRadius = '4px';
            deleteButton.addEventListener('click', () => {
                removeProcessedItem(index); // 删除该项
            });
            actionCell.appendChild(deleteButton);
            actionCell.style.textAlign = 'center';

            row.appendChild(contentCell);
            row.appendChild(actionCell);

            processedTable.querySelector('tbody').appendChild(row);
        });
    }

    // 启动定时任务
    function startProcessingItems() {
        //const interval = 5000 ; // 每隔5秒检查一次（可以根据需要调整）

        const interval = 60000 * 5 ; // 每隔5秒检查一次（可以根据需要调整）
        setInterval(() => {
            processPendingItems();
        }, interval);
    }

    // 处理待处理项
    function processPendingItems() {
        pendingItems.forEach((item, index) => {
            getTickInfo(item.text, false);
        });
    }


    // 初始化
    initializeData();
    createTable();
    renderPendingItems(); // 渲染待处理项
    renderProcessedItems(); // 渲染已处理项
    startProcessingItems(); // 启动定时任务
})();

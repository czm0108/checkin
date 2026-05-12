const glados = async () => {
  const notice = []
  if (!process.env.GLADOS) return
  for (const cookie of String(process.env.GLADOS).split('\n')) {
    if (!cookie) continue
    try {
      const common = {
        'cookie': cookie,
        'referer': 'https://glados.cloud/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
      }
      const action = await fetch('https://glados.cloud/api/user/checkin', {
        method: 'POST',
        headers: { ...common, 'content-type': 'application/json' },
        body: '{"token": "glados.cloud"}',
      }).then((r) => r.json())
      if (action?.code) throw new Error(action?.message)
      const status = await fetch('https://glados.cloud/api/user/status', {
        method: 'GET',
        headers: { ...common },
      }).then((r) => r.json())
      if (status?.code) throw new Error(status?.message)
      notice.push(
        'Checkin OK',
        `${action?.message}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

// 新增龙湖签到函数
const longfor = async () => {
  const notice = []
  if (!process.env.LONGFOR) return
  const accounts = String(process.env.LONGFOR).split('\n')
  
  console.log(`检测到 ${accounts.length} 个龙湖账户配置`)
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    if (!account) continue
    
    console.log(`正在处理第 ${i+1} 个账户配置`)
    
    try {
      // 支持两种格式：旧格式（6个字段）和新格式（7个字段用于区分平台）
      const fields = account.split('|')
      let userToken, buCode, apiKey, dxRiskToken, activityNo, cookie, platform
      
      if (fields.length === 6) {
        // 旧格式：兼容小程序
        [userToken, buCode, apiKey, dxRiskToken, activityNo, cookie] = fields
        platform = 'miniapp' // 默认为小程序
      } else if (fields.length === 7) {
        // 新格式：支持区分小程序和APP
        [userToken, buCode, apiKey, dxRiskToken, activityNo, cookie, platform] = fields
      } else {
        throw new Error(`参数格式错误，应为7个字段，实际为${fields.length}个字段: ${account}`)
      }
      
      if (!userToken || !buCode || !apiKey || !dxRiskToken || !activityNo) {
        throw new Error('龙湖签到参数不完整，格式应为: userToken|buCode|apiKey|dxRiskToken|activityNo|cookie|[platform]')
      }

      console.log(`账户平台: ${platform}, 用户Token前8位: ${userToken.substring(0, 8)}`)

      // 根据平台设置不同的请求头
      let userAgent, dxRiskSource, channel
      
      if (platform.toLowerCase() === 'app') {
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 &MAIAWebKit_iOS_com.longfor.supera_1.25.0_202604231720_Default_3.3.1.0'
        dxRiskSource = '2'
        channel = 'L0'
      } else {
        // 默认为小程序
        userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080710) XWEB/1191'
        dxRiskSource = '5'
        channel = 'C2'
      }

      const headers = {
        'Host': 'gw2c-hw-open.longfor.com',
        'X-LF-UserToken': userToken,
        'X-LF-Bu-Code': buCode,
        'X-GAIA-API-KEY': apiKey,
        'User-Agent': userAgent,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'X-LF-DXRisk-Source': dxRiskSource,
        'X-LF-DXRisk-Captcha-Token': 'undefined',
        'X-LF-DXRisk-Token': dxRiskToken,
        'token': userToken,
        'X-LF-Channel': channel,
        'Origin': 'https://longzhu.longfor.com',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://longzhu.longfor.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
      
      // 如果提供了cookie，则添加到headers中
      if (cookie) {
        headers['Cookie'] = cookie
      }

      console.log(`发送请求到: https://gw2c-hw-open.longfor.com/lmarketing-task-api-mvc-prod/openapi/task/v1/signature/clock`)
      console.log(`请求Headers (部分): Host=${headers['Host']}, X-LF-UserToken=${headers['X-LF-UserToken']}, X-LF-Bu-Code=${headers['X-LF-Bu-Code']}, X-LF-Channel=${headers['X-LF-Channel']}, X-LF-DXRisk-Source=${headers['X-LF-DXRisk-Source']}`)
      console.log(`请求Body: {"activity_no":"${activityNo}"}`)

      const response = await fetch('https://gw2c-hw-open.longfor.com/lmarketing-task-api-mvc-prod/openapi/task/v1/signature/clock', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          'activity_no': activityNo
        })
      }).then(r => r.json())

      console.log(`API响应:`, JSON.stringify(response))

      // 处理API响应
      if (response?.code !== '0000') {
        throw new Error(`${response?.message || '龙湖签到失败'} [错误码: ${response?.code}]`)
      }
      
      // 根据is_popup字段判断签到状态
      if (response?.data?.is_popup === 1) {
        // 未签到，已获得奖励
        const rewardInfo = response?.data?.reward_info
        let rewardText = '未知奖励'
        
        if (rewardInfo && Array.isArray(rewardInfo) && rewardInfo.length > 0) {
          const reward = rewardInfo[0]
          if (reward.reward_type === 20) {
            rewardText = `获得${reward.reward_num}积分`
          } else {
            rewardText = `获得${reward.reward_num}奖励`
          }
        }
        
        notice.push(
          'Longfor Checkin OK',
          `用户: ${userToken.substring(0, 8)}...`,
          `平台: ${platform.toUpperCase()}`,
          `状态: 成功签到，${rewardText}`
        )
      } else if (response?.data?.is_popup === 0) {
        // 已签到
        notice.push(
          'Longfor Checkin OK',
          `用户: ${userToken.substring(0, 8)}...`,
          `平台: ${platform.toUpperCase()}`,
          `状态: 今日已签到`
        )
      } else {
        // 其他情况
        notice.push(
          'Longfor Checkin OK',
          `用户: ${userToken.substring(0, 8)}...`,
          `平台: ${platform.toUpperCase()}`,
          `状态: 签到完成`
        )
      }
    } catch (error) {
      console.error(`处理第 ${i+1} 个账户时发生错误:`, error.message || error)
      notice.push(
        'Longfor Checkin Error',
        `账户序号: ${i+1}`,
        `错误详情: ${error.message || error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  
  console.log(`龙湖签到处理完成，共产生 ${notice.length} 条通知消息`)
  return notice
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice) return
  for (const option of String(process.env.NOTIFY).split('\n')) {
    if (!option) continue
    try {
      if (option.startsWith('console:')) {
        for (const line of notice) {
          console.log(line)
        }
      } else if (option.startsWith('wxpusher:')) {
        await fetch(`https://wxpusher.zjiecode.com/api/send/message`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            appToken: option.split(':')[1],
            summary: notice[0],
            content: notice.join('<br>'),
            contentType: 3,
            uids: option.split(':').slice(2),
          }),
        })
      } else if (option.startsWith('pushplus:')) {
        await fetch(`https://www.pushplus.plus/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: option.split(':')[1],
            title: notice[0],
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        })
      } else if (option.startsWith('qyweixin:')) {
        const qyweixinToken = option.split(':')[1]
        const qyweixinNotifyRebotUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + qyweixinToken;
        await fetch(qyweixinNotifyRebotUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: {
                content: notice.join('<br>')
            }
          }),
        })
      } else {
        // fallback
        await fetch(`https://www.pushplus.plus/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: option,
            title: notice[0],
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        })
      }
    } catch (error) {
      throw error
    }
  }
}

const main = async () => {
  console.log("开始执行签到任务...")
  
  // 获取GLaDOS签到结果
  console.log("开始GLaDOS签到...")
  const gladosResult = await glados() || []
  console.log(`GLaDOS签到完成，结果条数: ${gladosResult.length}`)
  
  // 获取龙湖签到结果
  console.log("开始龙湖签到...")
  const longforResult = await longfor() || []
  console.log(`龙湖签到完成，结果条数: ${longforResult.length}`)
  
  // 合并所有结果
  const allNotices = [...gladosResult, ...longforResult]
  console.log(`合并结果完成，总条数: ${allNotices.length}`)
  
  // 发送通知
  console.log("开始发送通知...")
  await notify(allNotices)
  console.log("通知发送完成")
}

main()

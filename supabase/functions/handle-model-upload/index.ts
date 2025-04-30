// 导入必要的依赖
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { decode as base64Decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

// 创建Supabase客户端
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// 使用服务角色密钥创建Supabase客户端，拥有更高权限
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 确保thumbnails存储桶存在
async function ensureThumbnailsBucketExists() {
  try {
    // 检查存储桶是否存在
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()

    if (bucketsError) {
      console.error('获取存储桶列表错误:', bucketsError)
      return false
    }

    // 检查是否有名为'thumbnails'的存储桶
    const thumbnailsBucket = buckets.find(bucket => bucket.name === 'thumbnails')
    if (!thumbnailsBucket) {
      console.log('没有找到名为"thumbnails"的存储桶，尝试创建...')
      const { data, error } = await supabase.storage.createBucket('thumbnails', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg']
      })

      if (error) {
        console.error('创建存储桶失败:', error)
        return false
      } else {
        console.log('成功创建"thumbnails"存储桶:', data)
        return true
      }
    } else {
      console.log('找到"thumbnails"存储桶:', thumbnailsBucket)
      return true
    }
  } catch (error) {
    console.error('检查/创建存储桶时出错:', error)
    return false
  }
}

// 生成缩略图并上传到存储桶
async function generateAndUploadThumbnail(modelUrl: string, modelName: string): Promise<string | null> {
  try {
    // 确保thumbnails存储桶存在
    const bucketExists = await ensureThumbnailsBucketExists()
    if (!bucketExists) {
      console.error('无法确保thumbnails存储桶存在')
      return null
    }

    // 这里我们无法在Edge Function中直接渲染3D模型
    // 所以我们使用一个简单的占位图像
    // 在实际应用中，你可能需要一个单独的服务来生成缩略图

    // 创建一个简单的彩色方块作为缩略图
    const canvas = new OffscreenCanvas(256, 256)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      console.error('无法创建2D上下文')
      return null
    }

    // 生成一个基于模型名称的随机颜色
    const hash = modelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const r = (hash % 200) + 55 // 55-255 范围内的红色值
    const g = ((hash * 2) % 200) + 55 // 55-255 范围内的绿色值
    const b = ((hash * 3) % 200) + 55 // 55-255 范围内的蓝色值

    // 绘制背景
    ctx.fillStyle = '#222222'
    ctx.fillRect(0, 0, 256, 256)

    // 绘制中心的彩色方块
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(64, 64, 128, 128)

    // 绘制边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(64, 64, 128, 128)

    // 绘制模型名称
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'

    // 截断过长的名称
    let displayName = modelName
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 17) + '...'
    }

    ctx.fillText(displayName, 128, 220)

    // 转换为Blob
    const blob = await canvas.convertToBlob({ type: 'image/png' })

    // 生成唯一的文件名
    const fileName = `${Date.now()}_${modelName.replace(/\.[^/.]+$/, '')}_thumbnail.png`

    // 上传到Supabase
    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      })

    if (error) {
      console.error('上传缩略图失败:', error)
      return null
    }

    // 获取公共URL
    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    console.error('生成和上传缩略图时出错:', error)
    return null
  }
}

// 处理存储桶事件的函数
serve(async (req) => {
  try {
    // 解析请求体
    const payload = await req.json()

    // 记录接收到的事件
    console.log('收到存储事件:', JSON.stringify(payload, null, 2))

    // 检查是否是创建文件事件
    if (payload.type === 'INSERT' && payload.table === 'objects') {
      const fileRecord = payload.record

      // 确保是模型存储桶中的文件
      if (fileRecord.bucket_id === 'models') {
        // 获取文件名和路径
        const filePath = fileRecord.name
        const fileName = filePath.split('/').pop() || filePath

        // 生成文件的公共URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('models')
          .getPublicUrl(filePath)

        // 生成并上传缩略图
        console.log('正在为模型生成缩略图:', fileName)
        const thumbnailUrl = await generateAndUploadThumbnail(publicUrl, fileName)

        if (thumbnailUrl) {
          console.log('缩略图生成并上传成功:', thumbnailUrl)
        } else {
          console.warn('无法生成缩略图，将使用默认图标')
        }

        // 创建模型记录
        const { data, error } = await supabase
          .from('models')
          .insert([
            {
              name: fileName,
              file_path: publicUrl,
              thumbnail_url: thumbnailUrl,
              description: `自动添加的模型: ${fileName}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select()

        if (error) {
          console.error('添加模型记录失败:', error)
          return new Response(JSON.stringify({ error: '添加模型记录失败' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
          })
        }

        console.log('成功添加模型记录:', data)
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      }
    }

    // 如果不是我们关心的事件，返回成功
    return new Response(JSON.stringify({ success: true, message: '事件已处理，但不需要操作' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('处理事件时出错:', error)
    return new Response(JSON.stringify({ error: '处理事件时出错' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

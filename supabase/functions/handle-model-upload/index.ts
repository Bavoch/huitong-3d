// 导入必要的依赖
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// 创建Supabase客户端
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// 使用服务角色密钥创建Supabase客户端，拥有更高权限
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        
        // 创建模型记录
        const { data, error } = await supabase
          .from('models')
          .insert([
            {
              name: fileName,
              file_path: publicUrl,
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

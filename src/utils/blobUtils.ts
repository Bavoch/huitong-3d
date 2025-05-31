/**
 * 从 Data URL 中提取 MIME 类型。
 * @param dataUrl Base64 Data URL 字符串
 * @returns MIME 类型字符串，如果无法提取则返回 undefined
 */
export const extractMimeType = (dataUrl: string): string | undefined => {
  const match = dataUrl.match(/^data:([\w\/\-\.]+);base64,/);
  return match ? match[1] : undefined;
};

/**
 * 将 Base64 编码的字符串转换为 Blob 对象。
 * @param base64 Base64 字符串 (应不包含 "data:...;base64," 前缀)
 * @param type Blob 的 MIME 类型
 * @returns Blob 对象
 */
export const base64ToBlob = (base64: string, type = 'application/octet-stream'): Blob => {
  // 移除 Data URL 前缀 (如果存在)
  const base64Data = base64.startsWith('data:') ? base64.substring(base64.indexOf(',') + 1) : base64;
  
  try {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  } catch (e) {
    console.error('Failed to convert base64 to Blob:', e);
    // 返回一个空的 Blob 或者可以抛出错误，取决于如何处理失败情况
    return new Blob([], { type }); 
  }
};

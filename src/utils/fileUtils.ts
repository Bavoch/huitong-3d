/**
 * 读取文件内容作为 Base64 Data URL
 * @param file File 或 Blob 对象
 * @returns Promise，解析为文件的 Data URL 字符串
 */
export const readFileAsDataURL = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL.'));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
};

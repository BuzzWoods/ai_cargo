/**
 * 接口请求封装 - 适配 AI 场景
 * 支持标准 JSON 请求和 SSE (Server-Sent Events) 流式处理
 */

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  onStream?: (content: string, done: boolean) => void;
}

export const request = async (url: string, options: RequestOptions = {}) => {
  const { params, onStream, ...rest } = options;

  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams(params);
    finalUrl += `${url.includes('?') ? '&' : '?'}${searchParams.toString()}`;
  }

  const response = await fetch(finalUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...rest.headers,
    },
    ...rest,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // 处理流式响应 (SSE)
  if (onStream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      const chunk = decoder.decode(value, { stream: true });
      onStream(chunk, done);
    }
    return;
  }

  return response.json();
};

/**
 * 模拟 AI SSE 流式回复 (仅用于本地 Demo)
 */
export const simulateChatStream = async (content: string, onStream: (content: string, done: boolean) => void) => {
  const fullText = `[模拟回复] 您说的是“${content}”。目前项目已集成 React 19 + Vite 8 + Ant Design X。流式传输（SSE）封装已就绪，可随时对接后端。`;
  let currentText = '';
  
  for (let i = 0; i < fullText.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    currentText += fullText[i];
    onStream(currentText, i === fullText.length - 1);
  }
};

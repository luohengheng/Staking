import { useEffect, useState } from 'react';

// 自定义 Hook：判断当前环境
export const useEnvironment = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // useEffect 只会在客户端执行
    setIsClient(true);
  }, []);

  // 如果 isClient 为 false，说明是服务器环境
  return {
    isClient,
    isServer: !isClient,
  };
}
/* @flow */

// 依据base 计算出relative的真正路径
// 相对路径 基于base计算的来的
export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  // 如果是以/开头就是绝对路径 直接返回
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    return relative
  }

  // 如果是 query 或者 hash 就直接拼接后返回
  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  // 把base根据/分隔成数组
  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  // 传入参数如果不是添加的 并且 stack中没有元素最后一个是空字符串(证明base就是以/结尾)
  if (!append || !stack[stack.length - 1]) {
    // 把数组中最后一位删除
    stack.pop()
  }

  // resolve relative path
  // 相对路径替换最开头的/ 然后以/切割成数组
  const segments = relative.replace(/^\//, '').split('/')

  // 遍历
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    // ..就删除一个 标示网上找一级
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      // 其他的只要不是.（当前目录） 就是要继续添加 表示往下找
      stack.push(segment)
    }
  }

  // ensure leading slash
  // 头部不是以 空字符串开头 就添加一个空字符串到第一位 （为了后面的join组成以/开头的）
  if (stack[0] !== '') {
    stack.unshift('')
  }

  // 组成路径返回
  return stack.join('/')
}

export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  // 根据#分隔
  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    // 截取hash值
    hash = path.slice(hashIndex)
    // 截取路径值
    path = path.slice(0, hashIndex)
  }

  // 根据?分隔
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    // 截取参数
    query = path.slice(queryIndex + 1)
    // 截取路径
    path = path.slice(0, queryIndex)
  }

  return {
    path,
    query,
    hash
  }
}

// 替换 双斜杠为单斜杠
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}

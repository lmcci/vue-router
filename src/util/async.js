/* @flow */

// 执行队列
export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    // 第一次index为0

    if (index >= queue.length) {
      // 当队列中所有的都执行完了 就执行回调
      cb()
    } else {
      // 从队列中取得
      if (queue[index]) {
        // 调用fn 把队列中的对象当做参数传入
        fn(queue[index], () => {
          // 回调中 继续执行step index递增（执行下一个）
          step(index + 1)
        })
      } else {
        // 队列中没有 就继续向下执行
        step(index + 1)
      }
    }
  }
  step(0)
}

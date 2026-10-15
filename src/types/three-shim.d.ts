/* three 环境声明：@types/three 的巨型声明会在本机 Node24/TS5.9 触发 V8 Zone Allocation 崩溃，
   无法用于 astro check / tsc。运行时仍打包真实 three；此处仅放行类型检查（any 语义），
   行为正确性由 Playwright 实测覆盖。若日后类型包修复，可删本文件换回 @types/three。 */
declare module "three";

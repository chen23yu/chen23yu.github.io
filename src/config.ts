import type { ExpressiveCodeConfig, LicenseConfig, NavBarConfig, ProfileConfig, SiteConfig } from './types/config';
export const siteConfig: SiteConfig = {
  title: 'Paper Trails', subtitle: 'Papers, ideas & notes by chenyu23', lang: 'zh_CN',
  themeColor: { hue: 200, fixed: false },
  banner: { enable: true, src: '/images/paper-landscape.svg', position: 'center', credit: { enable: false, text: '' } },
  toc: { enable: true, depth: 3 }, favicon: [{ src: '/favicon.svg', sizes: 'any' }],
};
export const navBarConfig: NavBarConfig = { links: [
  { name: '首页', url: '/' }, { name: '文章归档', url: '/archive/' },
  { name: '关于', url: '/about/' }, { name: 'RSS', url: '/rss.xml', external: true },
] };
export const profileConfig: ProfileConfig = {
  avatar: '/images/avatar.svg', name: 'chenyu23', bio: 'Papers, ideas & the questions in between.',
  links: [{ name: 'RSS', icon: 'fa6-solid:rss', url: '/rss.xml' }],
};
export const licenseConfig: LicenseConfig = { enable: false, name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' };
export const expressiveCodeConfig: ExpressiveCodeConfig = { theme: 'github-dark' };

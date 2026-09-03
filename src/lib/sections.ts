export const CLASSIC = { href: "/classic", label: "Класичний" } as const;
export const BEACH = { href: "/beach", label: "Пляжний" } as const;
export const ARCHIVE = { href: "/archive", label: "Архів" } as const;

export const SECTIONS = [CLASSIC, BEACH, ARCHIVE] as const;

export function isActiveSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MenuLike = {
  contains: (target: Node | null) => boolean
}

export function shouldDismissPetContextMenu(target: EventTarget | null, menu: MenuLike | null) {
  if (!menu || !target) return false
  return !menu.contains(target as Node)
}

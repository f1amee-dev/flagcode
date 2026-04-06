import type { CtfCategory } from "@flagcode/contracts";
import { CTF_CATEGORIES } from "@flagcode/shared/ctf";
import { memo, useCallback, useState } from "react";
import {
  ChevronDownIcon,
  FingerprintIcon,
  GlobeIcon,
  LockIcon,
  PuzzleIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { cn } from "~/lib/utils";

export const CATEGORY_ICON_MAP: Record<CtfCategory, LucideIcon> = {
  crypto: LockIcon,
  pwn: ShieldIcon,
  "reverse-engineering": SearchIcon,
  web: GlobeIcon,
  forensics: FingerprintIcon,
  misc: PuzzleIcon,
};

const NONE_VALUE = "__none__";

export const CtfCategoryPicker = memo(function CtfCategoryPicker(props: {
  value: CtfCategory | null;
  onChange: (category: CtfCategory | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedCategory = props.value ? CTF_CATEGORIES.find((c) => c.id === props.value) : null;
  const CategoryIcon = props.value ? CATEGORY_ICON_MAP[props.value] : null;

  const handleValueChange = useCallback(
    (value: string) => {
      props.onChange(value === NONE_VALUE ? null : (value as CtfCategory));
      setIsMenuOpen(false);
    },
    [props.onChange],
  );

  return (
    <Menu
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (props.disabled) {
          setIsMenuOpen(false);
          return;
        }
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 justify-start overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 [&_svg]:mx-0",
              props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56 sm:px-3",
            )}
            disabled={props.disabled}
          />
        }
      >
        <span
          className={cn(
            "flex min-w-0 w-full box-border items-center gap-2 overflow-hidden",
            props.compact ? "max-w-36 sm:pl-1" : undefined,
          )}
        >
          {CategoryIcon ? (
            <CategoryIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{selectedCategory?.label ?? "Category"}</span>
          <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
        </span>
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuGroup>
          <MenuRadioGroup value={props.value ?? NONE_VALUE} onValueChange={handleValueChange}>
            <MenuRadioItem value={NONE_VALUE} onClick={() => setIsMenuOpen(false)}>
              <span className="flex items-center gap-2">
                <XIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
                None
              </span>
            </MenuRadioItem>
            <MenuSeparator />
            {CTF_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICON_MAP[category.id];
              return (
                <MenuRadioItem
                  key={category.id}
                  value={category.id}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
                    {category.label}
                  </span>
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
});

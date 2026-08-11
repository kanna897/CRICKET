import NextLink from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;

/** Prevent large navigation menus from eagerly rendering every linked route. */
export default function NoPrefetchLink(props: Props) {
  return <NextLink {...props} prefetch={props.prefetch ?? false} />;
}

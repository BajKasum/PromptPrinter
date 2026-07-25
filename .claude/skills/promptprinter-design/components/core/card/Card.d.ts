import type { ReactNode, HTMLAttributes } from "react";

/**
 * @startingPoint section="Core" subtitle="Flat surface, hairline border, subtle elevation" viewport="700x300"
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export declare function Card(props: CardProps): JSX.Element;
export declare function CardHeader(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
export declare function CardTitle(props: HTMLAttributes<HTMLHeadingElement>): JSX.Element;
export declare function CardDescription(props: HTMLAttributes<HTMLParagraphElement>): JSX.Element;
export declare function CardContent(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
export declare function CardFooter(props: HTMLAttributes<HTMLDivElement>): JSX.Element;

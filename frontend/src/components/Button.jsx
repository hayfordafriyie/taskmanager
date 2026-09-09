import { Link } from "react-router-dom";
import { base, buttonVariants, buttonSizes, cn } from "./buttonStyles";

export function Button({
  variant = "primary",
  size = "md",
  to,
  className,
  type = "button",
  disabled,
  children,
  ...props
}) {
  const classes = cn(base, buttonVariants[variant], buttonSizes[size], className);
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
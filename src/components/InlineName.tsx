import { makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";

const useStyles = makeStyles({
  input: {
    flex: 1,
    minWidth: 0,
    height: "26px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderBottom: `${tokens.strokeWidthThick} solid ${tokens.colorCompoundBrandStroke}`,
    borderRadius: tokens.borderRadiusMedium,
    outline: "none",
  },
});

interface InlineNameProps {
  label: string;
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/** Nome editado no lugar: Enter ou sair do campo grava, Esc cancela. Nome vazio cancela. */
function InlineName({ label, initial, onSubmit, onCancel }: InlineNameProps) {
  const styles = useStyles();
  const [name, setName] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // Evita gravar duas vezes quando o Enter também tira o foco do campo.
  const done = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function finish(submit: boolean) {
    if (done.current) return;
    done.current = true;
    if (submit && name.trim() !== "") onSubmit(name);
    else onCancel();
  }

  return (
    <input
      ref={input}
      aria-label={label}
      className={styles.input}
      value={name}
      onChange={(event) => setName(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(true);
        else if (event.key === "Escape") finish(false);
        else return;
        event.preventDefault();
      }}
    />
  );
}

export default InlineName;

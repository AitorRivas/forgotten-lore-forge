interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const FormField = ({ label, required, children, hint }: FormFieldProps) => (
  <div>
    <label className="text-sm font-display text-gold-light block mb-1.5">
      {label}
      {required && <span className="text-gold ml-0.5">*</span>}
      {!required && <span className="text-muted-foreground text-[10px] ml-1.5">(opcional)</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground/60 mt-1">{hint}</p>}
  </div>
);

export default FormField;

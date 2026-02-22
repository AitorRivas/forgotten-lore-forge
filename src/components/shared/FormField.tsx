interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const FormField = ({ label, required, children, hint }: FormFieldProps) => (
  <div>
    <label className="text-sm text-muted-foreground block mb-1">
      {label}
      {required && <span className="text-gold ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground/60 mt-1">{hint}</p>}
  </div>
);

export default FormField;

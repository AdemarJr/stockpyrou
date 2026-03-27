import { useForm } from "react-hook-form@7.55.0";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Supplier } from "../../types";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  contact: z.string().min(2, "Contato deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  reliability: z.coerce.number().min(0).max(100).optional(),
});

interface SupplierFormProps {
  initialData?: Supplier;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function SupplierForm({ initialData, onSubmit, isLoading, onCancel }: SupplierFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      contact: initialData?.contact || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      rating: initialData?.rating || 5,
      reliability: initialData?.reliability || 100,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        contact: initialData.contact,
        email: initialData.email || "",
        phone: initialData.phone || "",
        rating: initialData.rating || 5,
        reliability: initialData.reliability || 100,
      });
    } else {
      form.reset({
        name: "",
        contact: "",
        email: "",
        phone: "",
        rating: 5,
        reliability: 100,
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nome da Empresa <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Ex: Distribuidora XYZ" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Pessoa de Contato <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Ex: João Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                    <Input placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

            <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Avaliação (1-5)</FormLabel>
                <FormControl>
                    <Input type="number" min="1" max="5" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

            <FormField
            control={form.control}
            name="reliability"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Confiabilidade (%)</FormLabel>
                <FormControl>
                    <Input type="number" min="0" max="100" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : initialData ? "Atualizar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
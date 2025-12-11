import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Toaster, toast } from 'sonner';
import { MODELS } from '@/lib/chat';
import { Settings, Save, Loader2 } from 'lucide-react';
const settingsSchema = z.object({
  defaultModel: z.string().min(1, "Vui lòng chọn một mô hình mặc định."),
  r2PreviewToken: z.string().optional(),
  adminName: z.string().optional(),
});
type SettingsFormValues = z.infer<typeof settingsSchema>;
export function SettingsPage(): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultModel: '',
      r2PreviewToken: '',
      adminName: '',
    },
  });
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('oranji_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        form.reset(parsedSettings);
      } else {
        form.reset({ defaultModel: MODELS[0].id, r2PreviewToken: '', adminName: 'Admin' });
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
      toast.error("Không thể tải cài đặt đã lưu.");
    }
  }, [form]);
  const onSubmit = (data: SettingsFormValues) => {
    setIsSubmitting(true);
    try {
      localStorage.setItem('oranji_settings', JSON.stringify(data));
      toast.success('Cài đặt đã được lưu thành công!');
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
      toast.error('Đã xảy ra lỗi khi lưu cài đặt.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold font-display flex items-center gap-3">
            <Settings className="w-10 h-10" />
            Cài đặt
          </h1>
          <p className="text-muted-foreground mt-2">Quản lý cấu hình chung cho ứng dụng Oranji Agent.</p>
        </header>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Cấu hình ứng dụng</CardTitle>
            <CardDescription>Các thay đổi sẽ được lưu vào bộ nhớ cục bộ của trình duyệt của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="defaultModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mô hình AI mặc định</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn một mô hình..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODELS.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="r2PreviewToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token xem trước R2 (T��y chọn)</FormLabel>
                      <FormControl>
                        <Input placeholder="Nhập token của bạn..." {...field} />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Token này được sử dụng để truy cập các tài liệu được bảo vệ trong R2.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên quản trị viên</FormLabel>
                      <FormControl>
                        <Input placeholder="Tên của bạn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Lưu thay đổi
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <Toaster richColors />
    </div>
  );
}
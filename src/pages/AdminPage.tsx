import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileText, Trash2, BotMessageSquare, Database, Plus, Edit, PieChart as PieChartIcon, Loader2, MessageSquare, Download, Search } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { chatService, MOCK_PRODUCTS } from '@/lib/chat';
import { testWebhookConnection, sendTestMessage } from '@/lib/messenger';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Tên sản ph���m là bắt buộc'),
  description: z.string().optional(),
  price: z.number().min(0, 'Giá phải là số dương'),
  stock_quantity: z.number().int().min(0, 'Tồn kho phải là số nguyên dương'),
  category: z.string().optional(),
});
type ProductFormValues = z.infer<typeof productSchema>;
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
export function AdminPage(): JSX.Element {
  const [products, setProducts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<{ name: string; size: number; uploaded: string }[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState({ products: true, documents: true, prompt: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [verifyToken, setVerifyToken] = useState(localStorage.getItem('fb_verify_token') || '');
  const [pageToken, setPageToken] = useState(localStorage.getItem('fb_page_token') || '');
  const [productSearch, setProductSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });
  const fetchData = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, products: true, documents: true, prompt: true }));
    const productsRes = await chatService.getProducts();
    if (productsRes.success) setProducts(productsRes.data || []);
    else { setProducts(MOCK_PRODUCTS); toast.error("Không thể tải sản phẩm, hiển thị dữ liệu mẫu."); }
    setIsLoading(prev => ({ ...prev, products: false }));
    const docsRes = await chatService.getDocuments();
    if (docsRes.success) setDocuments(docsRes.data || []);
    setIsLoading(prev => ({ ...prev, documents: false }));
    const promptRes = await chatService.getSystemPrompt();
    if (promptRes.success) setSystemPrompt(promptRes.data?.prompt || '');
    setIsLoading(prev => ({ ...prev, prompt: false }));
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);
  const filteredDocuments = useMemo(() => {
    return documents.filter(d => d.name.toLowerCase().includes(documentSearch.toLowerCase()));
  }, [documents, documentSearch]);
  const handleSavePrompt = async () => {
    setIsSubmitting(true);
    const res = await chatService.updateSystemPrompt(systemPrompt);
    if (res.success) toast.success('Đã lưu lời nhắc hệ thống!');
    else toast.error('Lỗi khi lưu lời nhắc.');
    setIsSubmitting(false);
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsSubmitting(true);
      toast.info(`Đang tải lên: ${file.name}`);
      const res = await chatService.uploadDocument(file);
      if (res.success) {
        toast.success(`Tải lên thành công: ${file.name}`);
        fetchData();
      } else {
        toast.error(`Lỗi khi tải lên: ${res.error}`);
      }
      setIsSubmitting(false);
    }
  };
  const handleDeleteDocument = async (key: string) => {
    const res = await chatService.deleteDocument(key);
    if (res.success) {
      toast.success(`Đã xóa t��i liệu: ${key}`);
      fetchData();
    } else {
      toast.error(`Lỗi khi xóa: ${res.error}`);
    }
  };
  const onProductSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    const apiCall = editingProduct
      ? chatService.updateProduct(editingProduct.id, data)
      : chatService.createProduct(data);
    const res = await apiCall;
    if (res.success) {
      toast.success(`Đã ${editingProduct ? 'cập nhật' : 'tạo'} sản phẩm!`);
      fetchData();
      setIsProductDialogOpen(false);
    } else {
      toast.error(`Lỗi: ${res.error}`);
    }
    setIsSubmitting(false);
  };
  const handleDeleteProduct = async (id: string) => {
    const res = await chatService.deleteProduct(id);
    if (res.success) {
      toast.success('Đã xóa sản phẩm.');
      fetchData();
    } else {
      toast.error(`Lỗi khi xóa: ${res.error}`);
    }
  };
  const openProductDialog = (product: any | null) => {
    setEditingProduct(product);
    reset(product ? { ...product, price: Number(product.price), stock_quantity: Number(product.stock_quantity) } : {});
    setIsProductDialogOpen(true);
  };
  const handleTestWebhook = async () => {
    if (!verifyToken) {
      toast.warning('Vui lòng nhập Verify Token.');
      return;
    }
    const res = await testWebhookConnection(verifyToken);
    toast[res.success ? 'success' : 'error'](res.message);
  };
  const handleSendTestMessage = async () => {
    const res = await sendTestMessage('test-sender-id-123', 'Xin chào, đây là tin nhắn thử nghiệm!');
    toast[res.success ? 'success' : 'error'](res.message);
  };
  const handleExport = async (format: 'json' | 'csv') => {
    const res = await chatService.exportSessions(format);
    if (res.success && res.blob) {
      downloadBlob(res.blob, `sessions_export_${Date.now()}.${format}`);
      toast.success(`Đã xuất phiên thành công dưới dạng ${format.toUpperCase()}`);
    } else {
      toast.error(`Lỗi khi xuất: ${res.error}`);
    }
  };
  const COLORS = ['#F38020', '#D14615', '#111827', '#6B7280', '#F97316'];
  const stockData = products.filter(p => p.stock_quantity > 0).map(p => ({ name: p.name, value: p.stock_quantity }));
  const sessionData = [
    { date: '2024-07-01', sessions: 30 }, { date: '2024-07-02', sessions: 45 },
    { date: '2024-07-03', sessions: 60 }, { date: '2024-07-04', sessions: 50 },
    { date: '2024-07-05', sessions: 75 }, { date: '2024-07-06', sessions: 90 },
  ];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8 md:space-y-12">
        <header>
          <h1 className="text-4xl font-bold font-display">Bảng ��iều khiển quản trị</h1>
          <p className="text-muted-foreground mt-2">Quản lý chatbot, tài liệu và s���n phẩm của bạn.</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BotMessageSquare /> Quản lý Chatbot</CardTitle>
                <CardDescription>Chỉnh sửa lời nhắc hệ thống để định hướng hành vi của AI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="system-prompt" className="text-sm font-medium">Lời nhắc hệ thống</Label>
                  {isLoading.prompt ? <Loader2 className="animate-spin mt-2" /> :
                    <Textarea id="system-prompt" placeholder="Bạn là m���t trợ lý AI hữu ích..." className="mt-1 min-h-[150px]" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                  }
                </div>
                <Button onClick={handleSavePrompt} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu thay đổi
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Phân tích phiên</CardTitle>
                <CardDescription>Tổng quan về hoạt động của phiên theo thời gian.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={sessionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), 'MMM d')} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="#F38020" strokeWidth={2} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => handleExport('json')}><Download className="mr-2 h-4 w-4" /> Xuất JSON</Button>
                  <Button variant="outline" onClick={() => handleExport('csv')}><Download className="mr-2 h-4 w-4" /> Xuất CSV</Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare /> Tích hợp Messenger</CardTitle>
                <CardDescription>Cấu hình và kiểm tra webhook Facebook Messenger.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="verify-token">Verify Token</Label>
                  <Input id="verify-token" placeholder="Your secret verify token" value={verifyToken} onChange={e => { setVerifyToken(e.target.value); localStorage.setItem('fb_verify_token', e.target.value); }} aria-label="Facebook Verify Token" />
                </div>
                <div>
                  <Label htmlFor="page-token">Page Access Token</Label>
                  <Input id="page-token" placeholder="Your page access token" value={pageToken} onChange={e => { setPageToken(e.target.value); localStorage.setItem('fb_page_token', e.target.value); }} aria-label="Facebook Page Access Token" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleTestWebhook} className="flex-1">Kiểm tra Webhook</Button>
                  <Button variant="outline" onClick={handleSendTestMessage} className="flex-1">Gửi Test</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PieChartIcon /> Phân tích tồn kho</CardTitle>
                <CardDescription>Tổng quan tồn kho sản phẩm.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading.products ? <Loader2 className="animate-spin" /> :
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stockData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" labelLine={false} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {stockData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} sản phẩm`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                }
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText /> Quản lý tài liệu (R2)</CardTitle>
              <CardDescription>Tải lên và quản lý tài liệu để AI truy xuất.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4 gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Tìm kiếm tài liệu..." className="pl-8" value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} />
                </div>
                <Sheet>
                  <SheetTrigger asChild><Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" /> Tải lên</Button></SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Tải lên tài liệu mới</SheetTitle><SheetDescription>Tải tệp lên R2. AI sẽ có thể truy cập nội dung của các tệp này.</SheetDescription></SheetHeader>
                    <div className="py-4">
                      <Label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                        <UploadCloud className="w-10 h-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Kéo và thả hoặc nhấp để tải lên</p>
                      </Label>
                      <Input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} disabled={isSubmitting} />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="mt-4 space-y-2 h-72 overflow-y-auto pr-2">
                {isLoading.documents ? <Loader2 className="animate-spin" /> : filteredDocuments.map(doc => (
                  <div key={doc.name} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium truncate max-w-xs">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Delete ${doc.name}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Tài liệu sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>H���y</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDocument(doc.name)}>Xóa</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database /> Quản lý sản phẩm (D1)</CardTitle>
              <CardDescription>Xem và chỉnh sửa thông tin sản phẩm.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4 gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Tìm kiếm sản phẩm..." className="pl-8" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <DialogTrigger asChild><Button onClick={() => openProductDialog(null)}><Plus className="mr-2 h-4 w-4" /> Thêm</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingProduct ? 'Chỉnh sửa' : 'Tạo mới'} sản phẩm</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit(onProductSubmit)} className="space-y-4">
                      <div><Label htmlFor="name">Tên sản phẩm</Label><Input id="name" {...register('name')} />{errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}</div>
                      <div><Label htmlFor="description">Mô tả</Label><Textarea id="description" {...register('description')} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="price">Giá</Label><Input id="price" type="number" {...register('price', { valueAsNumber: true })} />{errors.price && <p className="text-red-500 text-sm">{errors.price.message}</p>}</div>
                        <div><Label htmlFor="stock_quantity">Tồn kho</Label><Input id="stock_quantity" type="number" {...register('stock_quantity', { valueAsNumber: true })} />{errors.stock_quantity && <p className="text-red-500 text-sm">{errors.stock_quantity.message}</p>}</div>
                      </div>
                      <div><Label htmlFor="category">Danh mục</Label><Input id="category" {...register('category')} /></div>
                      <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Tồn kho</TableHead><TableHead>Giá</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading.products ? <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow> :
                    filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} aria-label={`Edit ${product.name}`}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Delete ${product.name}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Xóa sản phẩm?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa sản phẩm vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster richColors />
    </div>
  );
}
from reportlab.pdfgen import canvas
c = canvas.Canvas('test_scanned.pdf')
c.showPage()
c.save()

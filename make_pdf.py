from reportlab.pdfgen import canvas

c = canvas.Canvas('test_real.pdf')
c.drawString(100, 750, 'This is a test research paper.')
c.drawString(100, 730, 'Abstract: Quantum network security is vital.')
c.drawString(100, 710, 'Introduction: We explore quantum networks.')
c.save()
